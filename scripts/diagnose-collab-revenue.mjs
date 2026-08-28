
import mongoose from "mongoose";
import fs from "fs";

for (const f of [".env.local", ".env"]) {
  if (fs.existsSync(f)) {
    try {
      process.loadEnvFile(f);
    } catch {}
  }
}
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI missing — checked .env.local and .env.");
  process.exit(1);
}

const ACCOUNTS = [
  "Cash Book",
  "HDFC Skin",
  "HDFC Medihub",
  "ICICI Medihub",
  "Mumbai Receipts",
  "Cash ( backend )",
  "Paytm ( Delhi T44P )",
  "Paytm ( Noida CK5Y )",
  "Bajaj Loan",
  "Fibe Loan",
  "Pine Lab",
];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

async function run() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });

  const CollabCase = mongoose.models.CollabCase || mongoose.model("CollabCase", new mongoose.Schema({}, { strict: false, collection: "collabcases" }));
  const Transactions = mongoose.models.Transactions || mongoose.model("Transactions", new mongoose.Schema({}, { strict: false, collection: "transactions" }));
  const Patient = mongoose.models.Patient || mongoose.model("Patient", new mongoose.Schema({}, { strict: false, collection: "patients" }));
  const Payable = mongoose.models.Payable || mongoose.model("Payable", new mongoose.Schema({}, { strict: false, collection: "payables" }));
  const Receivable = mongoose.models.Receivable || mongoose.model("Receivable", new mongoose.Schema({}, { strict: false, collection: "receivables" }));
  const AccountPeriod = mongoose.models.AccountPeriod || mongoose.model("AccountPeriod", new mongoose.Schema({}, { strict: false, collection: "accountperiods" }));

  console.log("=".repeat(90));
  console.log("COLLAB REVENUE DIAGNOSTIC — READ ONLY");
  console.log("=".repeat(90));

  const cases = await CollabCase.find({}).lean();
  console.log(`\nFound ${cases.length} collab case(s).\n`);

  const closedPeriods = await AccountPeriod.find({ branch: null, isClosed: true }).lean();
  function isClosedForDate(account, date) {
    if (!date) return false;
    const t = new Date(date).getTime();
    const rows = closedPeriods.filter(
      (p) =>
        p.account === account &&
        new Date(p.periodStart).getTime() !== new Date(p.periodEnd).getTime() &&
        new Date(p.periodStart).getTime() <= t &&
        new Date(p.periodEnd).getTime() >= t,
    );
    return rows.length > 0 ? rows[0] : null;
  }
  function periodStatusForTransaction(tx) {
    if (!tx?.date) return { closed: false, reason: null };
    if (tx.furtherMode && ACCOUNTS.includes(tx.furtherMode)) {
      const closed = isClosedForDate(tx.furtherMode, tx.date);
      return closed
        ? { closed: true, reason: `${tx.furtherMode} closed ${new Date(closed.periodStart).toLocaleDateString("en-IN")}–${new Date(closed.periodEnd).toLocaleDateString("en-IN")}` }
        : { closed: false, reason: null };
    }
    const allClosed = ACCOUNTS.every((a) => isClosedForDate(a, tx.date));
    return { closed: allClosed, reason: allClosed ? "all accounts closed for this date" : null };
  }

  async function settledSummary(kind, id) {
    if (!id) return { count: 0, total: 0 };
    const field = kind === "payable" ? "payableId" : "receivableId";
    const rows = await Transactions.find({ [field]: id }).select("amount").lean();
    return { count: rows.length, total: round2(rows.reduce((s, r) => s + (r.amount || 0), 0)) };
  }

  const report = [];
  let totalOverstatementOpen = 0;
  let totalOverstatementClosed = 0;

  for (const c of cases) {
    const patient = c.patient ? await Patient.findById(c.patient).select("personal.name payments.amountReceived").lean() : null;

    const grossTxCandidates = await Transactions.find({
      "collabRef.caseId": c._id,
      costType: "Revenue",
      collabSplit: { $exists: true },
    })
      .select("amount date furtherMode collabSplit collabRef")
      .lean();

    if (grossTxCandidates.length === 0) {
      report.push({
        _id: String(c._id),
        patientName: patient?.personal?.name || null,
        clinic: c.clinic,
        packageAmount: c.packageAmount,
        status: c.status,
        createdAt: c.createdAt,
        note: "No old-style gross transaction found — either already fixed, or created with no revenue transaction at all (investigate).",
      });
      continue;
    }

    for (const grossTx of grossTxCandidates) {
      const ourReceived = grossTx.collabSplit?.ourReceived || 0;
      const clinicReceived = grossTx.collabSplit?.clinicReceived || 0;

      const laterCollections = (c.clinicCollections || []).reduce(
        (sum, cc) => sum + (cc.amount || 0),
        0,
      );

      const accountedFor = round2(ourReceived + clinicReceived + laterCollections);
      const overstatement = round2((grossTx.amount || 0) - accountedFor);

      const periodStatus = periodStatusForTransaction(grossTx);

      const payableId = c.clinicSharePayable || grossTx.collabRef?.payableId || null;
      const receivableId = c.clinicShareReceivable || grossTx.collabRef?.receivableId || null;
      const [payable, receivable] = await Promise.all([
        payableId ? Payable.findById(payableId).select("totalAmount payee").lean() : null,
        receivableId ? Receivable.findById(receivableId).select("totalAmount payer").lean() : null,
      ]);
      const [payableSettled, receivableSettled] = await Promise.all([
        settledSummary("payable", payableId),
        settledSummary("receivable", receivableId),
      ]);

      const patientAmountReceived = patient?.payments?.amountReceived || 0;
      const patientAgrees = ourReceived === 0 || patientAmountReceived >= ourReceived;

      const row = {
        _id: String(c._id),
        patientName: patient?.personal?.name || null,
        clinic: c.clinic,
        packageAmount: c.packageAmount,
        status: c.status,
        createdAt: c.createdAt,
        grossTransactionId: String(grossTx._id),
        grossTransactionAmount: grossTx.amount,
        grossTransactionDate: grossTx.date,
        recordedOurReceived: ourReceived,
        recordedClinicReceived: clinicReceived,
        laterClinicCollectionsSum: round2(laterCollections),
        accountedFor,
        overstatement,
        periodClosed: periodStatus.closed,
        periodClosedReason: periodStatus.reason,
        linkedPayableId: payableId ? String(payableId) : null,
        linkedPayableAmount: payable?.totalAmount ?? null,
        linkedPayableSettledCount: payableSettled.count,
        linkedPayableSettledTotal: payableSettled.total,
        linkedReceivableId: receivableId ? String(receivableId) : null,
        linkedReceivableAmount: receivable?.totalAmount ?? null,
        linkedReceivableSettledCount: receivableSettled.count,
        linkedReceivableSettledTotal: receivableSettled.total,
        hasAnySettlement: payableSettled.count > 0 || receivableSettled.count > 0,
        patientAmountReceived,
        patientAmountReceivedAgrees: patientAgrees,
      };
      report.push(row);

      if (overstatement > 0.005) {
        if (periodStatus.closed) totalOverstatementClosed += overstatement;
        else totalOverstatementOpen += overstatement;
      }
    }
  }

  console.log("Per-case summary:\n");
  for (const r of report) {
    if (r.note) {
      console.log(`  ${r._id}  ${(r.patientName || "?").padEnd(24)} ${r.clinic.padEnd(12)} — ${r.note}`);
      continue;
    }
    const flags = [
      r.overstatement > 0.005 ? `OVERSTATED ₹${r.overstatement}` : "ok",
      r.periodClosed ? "PERIOD CLOSED" : null,
      r.hasAnySettlement ? "HAS SETTLEMENTS" : null,
      !r.patientAmountReceivedAgrees ? "PATIENT MISMATCH" : null,
    ]
      .filter(Boolean)
      .join(" | ");
    console.log(
      `  ${r._id}  ${(r.patientName || "?").padEnd(24)} ${r.clinic.padEnd(12)} pkg ₹${String(r.packageAmount).padEnd(10)} gross ₹${String(r.grossTransactionAmount).padEnd(10)} accountedFor ₹${String(r.accountedFor).padEnd(10)} — ${flags}`,
    );
  }

  const totalOverstatement = round2(totalOverstatementOpen + totalOverstatementClosed);
  console.log("\n" + "=".repeat(90));
  console.log("TOTALS");
  console.log("=".repeat(90));
  console.log(`Total overstatement, OPEN periods:   ₹${totalOverstatementOpen}`);
  console.log(`Total overstatement, CLOSED periods: ₹${totalOverstatementClosed}`);
  console.log(`Total overstatement, ALL:             ₹${totalOverstatement}`);
  console.log(`Cases with a settlement already against a linked document: ${report.filter((r) => r.hasAnySettlement).length}`);
  console.log(`Cases with a patient amountReceived mismatch: ${report.filter((r) => r.patientAmountReceivedAgrees === false).length}`);

  const reportPath = `collab-revenue-diagnostic-${Date.now()}.json`;
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        caseCount: cases.length,
        totalOverstatementOpen: round2(totalOverstatementOpen),
        totalOverstatementClosed: round2(totalOverstatementClosed),
        totalOverstatement,
        cases: report,
      },
      null,
      2,
    ),
  );
  console.log(`\nFull report written to ${reportPath}`);

  await mongoose.disconnect();
  console.log("\nDone. This script wrote nothing to the database.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
