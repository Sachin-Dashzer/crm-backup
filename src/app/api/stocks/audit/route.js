import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Stock from "@/models/Stock";
import Transactions from "@/models/Transactions";
import Vendor from "@/models/Vendor";
import { UNSETTLED_METHODS } from "@/constants/bankRouting";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const stockId    = searchParams.get("stockId");
    const location   = searchParams.get("location");
    const from       = searchParams.get("from");
    const to         = searchParams.get("to");
    const eventType  = searchParams.get("eventType"); // PURCHASE | SALE | ALL

    const isAdmin    = ["admin", "super-admin"].includes(session.user.role);
    const userBranch = session.user.branch;

    // ── 1. Fetch Stocks ──────────────────────────────────────────────────────
    const stockQuery = {};
    if (stockId)                          stockQuery._id      = stockId;
    if (!isAdmin && userBranch)           stockQuery.location = userBranch;
    else if (location && location !== "All") stockQuery.location = location;

    const stocks = await Stock.find(stockQuery).lean();
    const stockMap = {};
    stocks.forEach(s => { stockMap[s._id.toString()] = s; });
    const stockIds = stocks.map(s => s._id);

    // ── 2. Fetch MEDICINE Transactions (sales) ────────────────────────────────
    const txQuery = {
      transactionCategory: "MEDICINE",
      medicineId: { $in: stockIds },
    };
    if (!isAdmin && userBranch) txQuery.branch = userBranch;

    const saleTxns = await Transactions.find(txQuery)
      .populate("patient", "personal.name personal.phone")
      .lean();

    // ── 3. Fetch Vendors (for purchase event labels) ───────────────────────────
    const allVendors = await Vendor.find({}).select("_id name").lean();
    const vendorMap = {};
    allVendors.forEach(v => { vendorMap[v._id.toString()] = v.name; });

    // ── 4. Build events array ─────────────────────────────────────────────────
    const events = [];

    // — Purchase events from Stock.editors[] ——————————————————————————————————
    if (!eventType || eventType === "ALL" || eventType === "PURCHASE") {
      for (const stock of stocks) {
        for (const editor of (stock.editors || [])) {
          // A purchase entry always updates totalQuantity
          const qtyField = editor.updatedFields?.find(f => f.name === "totalQuantity");
          if (!qtyField) continue;

          const prevQty  = parseFloat(qtyField.previousValue) || 0;
          const newQty   = parseFloat(qtyField.newValue)      || 0;
          const qtyAdded = newQty - prevQty;
          if (qtyAdded <= 0) continue; // skip if quantity decreased (manual edit)

          const priceField  = editor.updatedFields?.find(f => f.name === "purchaseAmt");
          const vendorField = editor.updatedFields?.find(f => f.name === "vendor");
          const unitPrice   = priceField ? (parseFloat(priceField.newValue) || 0) : (stock.purchaseAmt || 0);
          const totalCost   = qtyAdded * unitPrice;
          const vendorId    = vendorField?.newValue || "";
          const vendorName  = vendorMap[vendorId] || "Unknown Vendor";

          const eventDate = editor.date ? new Date(editor.date) : null;

          // Apply date filter
          if (from && eventDate && eventDate < new Date(from)) continue;
          if (to   && eventDate && eventDate > new Date(new Date(to).setHours(23, 59, 59, 999))) continue;

          events.push({
            type:        "PURCHASE",
            stockId:     stock._id.toString(),
            stockName:   stock.name,
            location:    stock.location || "—",
            date:        editor.date || null,
            quantity:    qtyAdded,
            unitPrice,
            totalAmount: totalCost,
            party: {
              type:   "vendor",
              name:   vendorName,
              id:     vendorId,
            },
            by: {
              name:   editor.name   || "—",
              email:  editor.email  || "",
              branch: editor.branch || "—",
            },
            profit: null,
          });
        }
      }
    }

    // — Sale events from MEDICINE Transactions ————————————————————————————————
    if (!eventType || eventType === "ALL" || eventType === "SALE") {
      for (const tx of saleTxns) {
        const stockRef = stockMap[tx.medicineId?.toString()];
        if (!stockRef) continue;

        const eventDate = tx.date ? new Date(tx.date) : null;
        if (from && eventDate && eventDate < new Date(from)) continue;
        if (to   && eventDate && eventDate > new Date(new Date(to).setHours(23, 59, 59, 999))) continue;

        const qty         = tx.quantity    || 1;
        const unitSell    = tx.perUnitCost || (tx.amount / qty);
        const totalRev    = tx.amount      || 0;
        const unitCost    = stockRef.purchaseAmt || 0;
        const totalCost   = qty * unitCost;
        const profit      = totalRev - totalCost;

        const patientName  = tx.patient?.personal?.name || tx.patientName || "Walk-in";
        const patientPhone = tx.patient?.personal?.phone || tx.patientPhone || "";

        events.push({
          type:        "SALE",
          stockId:     stockRef._id.toString(),
          stockName:   stockRef.name,
          location:    tx.branch || stockRef.location || "—",
          date:        tx.date   || null,
          quantity:    qty,
          unitPrice:   unitSell,
          totalAmount: totalRev,
          discount:    tx.discount || 0,
          method:      tx.method  || "",
          party: {
            type:    "patient",
            name:    patientName,
            phone:   patientPhone,
            id:      tx.patient?._id?.toString() || "",
          },
          by: {
            name:   tx.createdBy?.name   || "—",
            email:  tx.createdBy?.email  || "",
            branch: tx.createdBy?.branch || tx.branch || "—",
          },
          purchasePrice: unitCost,
          totalCost,
          profit,
          transactionId: tx._id.toString(),
        });
      }
    }

    // Sort all events newest-first
    events.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    // ── 5. Per-stock summaries ─────────────────────────────────────────────────
    const summaryMap = {};
    for (const stock of stocks) {
      summaryMap[stock._id.toString()] = {
        _id:             stock._id.toString(),
        name:            stock.name,
        location:        stock.location || "—",
        currentQty:      stock.totalQuantity || 0,
        mrp:             stock.mrp || 0,
        purchaseAmt:     stock.purchaseAmt || 0,
        unitsSold:       0,
        unitsPurchased:  0,
        totalRevenue:    0,
        totalCost:       0,
        totalProfit:     0,
      };
    }

    for (const ev of events) {
      const s = summaryMap[ev.stockId];
      if (!s) continue;
      if (ev.type === "PURCHASE") {
        s.unitsPurchased += ev.quantity;
        s.totalCost      += ev.totalAmount;
      } else {
        // Every sale event still shows in `events` (with its method, badged in the UI) — only
        // the revenue/profit TOTALS below exclude paid_to_external, since that money isn't
        // ours yet. Units sold still counts — the stock genuinely left the shelf.
        s.unitsSold += ev.quantity;
        if (!UNSETTLED_METHODS.includes(ev.method)) {
          s.totalRevenue += ev.totalAmount;
          s.totalProfit  += (ev.profit || 0);
        }
      }
    }

    const stockSummaries = Object.values(summaryMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

    // ── 6. Overall summary ────────────────────────────────────────────────────
    const summary = stockSummaries.reduce(
      (acc, s) => {
        acc.totalRevenue    += s.totalRevenue;
        acc.totalCost       += s.totalCost;
        acc.totalProfit     += s.totalProfit;
        acc.unitsSold       += s.unitsSold;
        acc.unitsPurchased  += s.unitsPurchased;
        return acc;
      },
      { totalRevenue: 0, totalCost: 0, totalProfit: 0, unitsSold: 0, unitsPurchased: 0 }
    );
    summary.totalStocks = stocks.length;

    return NextResponse.json({
      success: true,
      summary,
      events,
      stockSummaries,
      currentUser: {
        name:   session.user.name   || "",
        branch: session.user.branch || "",
        email:  session.user.email  || "",
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching stock audit:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch stock audit", error: error.message },
      { status: 500 }
    );
  }
}
