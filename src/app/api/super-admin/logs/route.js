import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Patient from "@/models/Patient";
import Transactions from "@/models/Transactions";
import Stock from "@/models/Stock";
import DeleteLog from "@/models/DeleteLog";

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

// Strict date range check — null dates are excluded when a range is active
function inRange(date, dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return true;
  if (!date) return false;
  const d = new Date(date);
  return d >= dateFrom && d <= dateTo;
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session?.user?.role !== "super-admin") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const branch = searchParams.get("branch");

    const dateFrom = from ? new Date(from) : null;
    const dateTo = to ? new Date(to) : null;

    let data = [];

    switch (type) {
      // ── PATIENT CHANGES LOG ──────────────────────────────────────────
      case "patient-changes-log": {
        const query = branch ? { "personal.branch": branch } : {};

        const patients = await Patient.find(query)
          .select("personal.name personal.phone personal.branch editors createdBy createdAt")
          .lean();

        for (const patient of patients) {
          const name = patient.personal?.name || "Unknown";
          const phone = patient.personal?.phone || "";
          const patientBranch = patient.personal?.branch || "";

          // Fallback to Mongoose createdAt when createdBy.date is missing
          const createdAt = patient.createdBy?.date
            ? new Date(patient.createdBy.date)
            : patient.createdAt
            ? new Date(patient.createdAt)
            : null;

          if (inRange(createdAt, dateFrom, dateTo)) {
            data.push({
              _sortTs: createdAt ? createdAt.getTime() : 0,
              "Action": "Created",
              "Patient Name": name,
              "Patient Phone": phone,
              "Branch": patientBranch,
              "Changed By": patient.createdBy?.name || "System",
              "Changed By Email": patient.createdBy?.email || "",
              "Changed By Branch": patient.createdBy?.branch || patientBranch,
              "Date & Time": fmtDate(createdAt),
              "Fields Changed": "New patient record created",
            });
          }

          for (const editor of patient.editors || []) {
            const editDate = editor.date ? new Date(editor.date) : null;
            if (!inRange(editDate, dateFrom, dateTo)) continue;

            data.push({
              _sortTs: editDate ? editDate.getTime() : 0,
              "Action": "Updated",
              "Patient Name": name,
              "Patient Phone": phone,
              "Branch": patientBranch,
              "Changed By": editor.name || "",
              "Changed By Email": editor.email || "",
              "Changed By Branch": editor.branch || "",
              "Date & Time": fmtDate(editDate),
              "Fields Changed": editor.updatedFields?.length
                ? editor.updatedFields
                    .map((f) => `${f.name}: ${f.previousValue} → ${f.newValue}`)
                    .join("; ")
                : "Record updated",
            });
          }
        }

        data.sort((a, b) => b._sortTs - a._sortTs);
        data = data.map(({ _sortTs, ...rest }) => rest);
        break;
      }

      // ── TRANSACTION CHANGES LOG ──────────────────────────────────────
      case "transaction-changes-log": {
        const txQuery = branch ? { branch } : {};

        const transactions = await Transactions.find(txQuery)
          .select(
            "transactionCategory procedure costType amount method branch date patientName createdBy editors createdAt"
          )
          .lean();

        for (const tx of transactions) {
          const txLabel =
            tx.patientName || tx.procedure || tx.transactionCategory || "Transaction";
          const txBranch = tx.branch || "";
          const txDateFmt = tx.date
            ? new Date(tx.date).toLocaleDateString("en-IN")
            : "";

          const createdAt = tx.createdBy?.date
            ? new Date(tx.createdBy.date)
            : tx.createdAt
            ? new Date(tx.createdAt)
            : null;

          if (inRange(createdAt, dateFrom, dateTo)) {
            data.push({
              _sortTs: createdAt ? createdAt.getTime() : 0,
              "Action": "Created",
              "Transaction": txLabel,
              "Category": tx.transactionCategory || "",
              "Procedure": tx.procedure || "",
              "Cost Type": tx.costType || "",
              "Amount (₹)": tx.amount || 0,
              "Method": tx.method || "",
              "Branch": txBranch,
              "Transaction Date": txDateFmt,
              "Changed By": tx.createdBy?.name || "System",
              "Changed By Email": tx.createdBy?.email || "",
              "Changed By Branch": tx.createdBy?.branch || txBranch,
              "Date & Time": fmtDate(createdAt),
              "Fields Changed": "New transaction created",
            });
          }

          for (const editor of tx.editors || []) {
            const editDate = editor.date ? new Date(editor.date) : null;
            if (!inRange(editDate, dateFrom, dateTo)) continue;

            data.push({
              _sortTs: editDate ? editDate.getTime() : 0,
              "Action": "Updated",
              "Transaction": txLabel,
              "Category": tx.transactionCategory || "",
              "Procedure": tx.procedure || "",
              "Cost Type": tx.costType || "",
              "Amount (₹)": tx.amount || 0,
              "Method": tx.method || "",
              "Branch": txBranch,
              "Transaction Date": txDateFmt,
              "Changed By": editor.name || "",
              "Changed By Email": editor.email || "",
              "Changed By Branch": editor.branch || "",
              "Date & Time": fmtDate(editDate),
              "Fields Changed": editor.updatedFields?.length
                ? editor.updatedFields
                    .map((f) => `${f.name}: ${f.previousValue} → ${f.newValue}`)
                    .join("; ")
                : "Record updated",
            });
          }
        }

        data.sort((a, b) => b._sortTs - a._sortTs);
        data = data.map(({ _sortTs, ...rest }) => rest);
        break;
      }

      // ── STOCK CHANGES LOG ────────────────────────────────────────────
      case "stock-changes-log": {
        const stockQuery = branch ? { location: branch } : {};

        const stocks = await Stock.find(stockQuery)
          .select("name location totalQuantity unit mrp createdBy editors createdAt")
          .lean();

        for (const stock of stocks) {
          const stockBranch = stock.location || "";

          const createdAt = stock.createdBy?.date
            ? new Date(stock.createdBy.date)
            : stock.createdAt
            ? new Date(stock.createdAt)
            : null;

          if (inRange(createdAt, dateFrom, dateTo)) {
            data.push({
              _sortTs: createdAt ? createdAt.getTime() : 0,
              "Action": "Created",
              "Stock Item": stock.name || "",
              "Location": stockBranch,
              "Current Qty": stock.totalQuantity || 0,
              "Unit": stock.unit || "",
              "MRP (₹)": stock.mrp || 0,
              "Changed By": stock.createdBy?.name || "System",
              "Changed By Email": stock.createdBy?.email || "",
              "Changed By Branch": stock.createdBy?.branch || stockBranch,
              "Date & Time": fmtDate(createdAt),
              "Fields Changed": "New stock item created",
            });
          }

          for (const editor of stock.editors || []) {
            const editDate = editor.date ? new Date(editor.date) : null;
            if (!inRange(editDate, dateFrom, dateTo)) continue;

            data.push({
              _sortTs: editDate ? editDate.getTime() : 0,
              "Action": "Updated",
              "Stock Item": stock.name || "",
              "Location": stockBranch,
              "Current Qty": stock.totalQuantity || 0,
              "Unit": stock.unit || "",
              "MRP (₹)": stock.mrp || 0,
              "Changed By": editor.name || "",
              "Changed By Email": editor.email || "",
              "Changed By Branch": editor.branch || "",
              "Date & Time": fmtDate(editDate),
              "Fields Changed": editor.updatedFields?.length
                ? editor.updatedFields
                    .map((f) => `${f.name}: ${f.previousValue} → ${f.newValue}`)
                    .join("; ")
                : "Record updated",
            });
          }
        }

        data.sort((a, b) => b._sortTs - a._sortTs);
        data = data.map(({ _sortTs, ...rest }) => rest);
        break;
      }

      // ── DELETE LOG ───────────────────────────────────────────────────
      case "delete-log": {
        const deleteQuery = {};
        if (branch) deleteQuery.branch = branch;
        if (dateFrom && dateTo) {
          deleteQuery.deletedAt = { $gte: dateFrom, $lte: dateTo };
        }

        const deleteLogs = await DeleteLog.find(deleteQuery)
          .sort({ deletedAt: -1 })
          .lean();

        data = deleteLogs.map((log) => ({
          "Entity Type": log.entityType || "",
          "Record Name": log.entityName || "",
          "Record ID": log.entityId || "",
          "Branch": log.branch || "",
          "Deleted By": log.deletedBy?.name || "",
          "Deleted By Email": log.deletedBy?.email || "",
          "Deleted By Branch": log.deletedBy?.branch || "",
          "Date & Time": fmtDate(log.deletedAt),
          "Details": log.entityDetails
            ? Object.entries(log.entityDetails)
                .filter(([, v]) => v !== null && v !== undefined && v !== "")
                .map(([k, v]) => `${k}: ${v}`)
                .join("; ")
            : "",
        }));
        break;
      }

      default:
        return NextResponse.json(
          { success: false, message: "Invalid log type" },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Logs API error:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
