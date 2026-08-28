import mongoose from "mongoose";
import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function readMongoUri() {
  for (const file of [".env.local", ".env"]) {
    const p = path.resolve(REPO_ROOT, file);

    if (!fs.existsSync(p)) continue;

    const m = fs
      .readFileSync(p, "utf8")
      .match(/^\s*MONGODB_URI\s*=\s*(.+)\s*$/m);

    if (m) {
      return m[1]
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }

  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }

  throw new Error(
    "MONGODB_URI not found in .env.local, .env, or the environment"
  );
}

const args = process.argv.slice(2);

const APPLY = args.includes("--apply");
const FORCE_LINKED = args.includes("--force-linked");

const START_DATE = new Date("2026-08-13T00:00:00.000Z");

const Transactions =
  mongoose.models.Transactions ||
  mongoose.model(
    "Transactions",
    new mongoose.Schema({}, { strict: false }),
    "transactions"
  );

const Payable =
  mongoose.models.Payable ||
  mongoose.model(
    "Payable",
    new mongoose.Schema({}, { strict: false }),
    "payables"
  );

const Receivable =
  mongoose.models.Receivable ||
  mongoose.model(
    "Receivable",
    new mongoose.Schema({}, { strict: false }),
    "receivables"
  );

function creatorLinks(txn) {
  const links = [];

  const ep = txn.externalParty || {};
  const cr = txn.collabRef || {};

  if (ep.linkedReceivableId) {
    links.push({
      kind: "receivable",
      id: ep.linkedReceivableId,
    });
  }

  if (ep.linkedPayableId) {
    links.push({
      kind: "payable",
      id: ep.linkedPayableId,
    });
  }

  if (cr.receivableId) {
    links.push({
      kind: "receivable",
      id: cr.receivableId,
    });
  }

  if (cr.payableId) {
    links.push({
      kind: "payable",
      id: cr.payableId,
    });
  }

  return links;
}

async function run() {
  console.log(
    APPLY
      ? "MODE: APPLY <- will delete from the database"
      : "MODE: DRY RUN <- nothing will be deleted"
  );

  console.log(
    'Filter: costType="Expenses", expense="Salary", date >= 2026-08-13 — no branch restriction\n'
  );

  await mongoose.connect(readMongoUri(), {
    serverSelectionTimeoutMS: 5000,
  });

  console.log("Connected to MongoDB.\n");

  const matches = await Transactions.find({
    costType: "Expenses",
    expense: "Electricity Bill",
    date: {
      $gte: START_DATE,
    },
  }).lean();

  console.log(
    `Found ${matches.length} Salary expense transaction(s) dated on or after 2026-08-13.`
  );

  if (matches.length === 0) {
    console.log("No matching transactions found.");

    await mongoose.disconnect();
    return;
  }

  const byBranch = {};
  let totalAmount = 0;

  for (const t of matches) {
    const branch = t.branch || "—";

    byBranch[branch] = (byBranch[branch] || 0) + 1;

    totalAmount += Number(t.amount) || 0;
  }

  console.log(
    `  By branch: ${Object.entries(byBranch)
      .map(([branch, count]) => `${branch}: ${count}`)
      .join(", ")}`
  );

  console.log(
    `  Total amount: ₹${totalAmount.toLocaleString("en-IN")}\n`
  );

  const safe = [];
  const linked = [];

  for (const t of matches) {
    const links = creatorLinks(t);

    if (links.length === 0) {
      safe.push(t);
      continue;
    }

    const details = [];

    for (const link of links) {
      const Model =
        link.kind === "payable"
          ? Payable
          : Receivable;

      const doc = await Model.findById(link.id).lean();

      if (!doc) continue;

      const others = await Transactions.countDocuments({
        [link.kind === "payable"
          ? "payableId"
          : "receivableId"]: link.id,

        _id: {
          $ne: t._id,
        },
      });

      details.push({
        kind: link.kind,
        id: String(link.id),
        otherPayments: others,
      });
    }

    if (details.length) {
      linked.push({
        txn: t,
        details,
      });
    } else {
      safe.push(t);
    }
  }

  if (linked.length) {
    console.log(
      `⚠ ${linked.length} row(s) created a Payable/Receivable and will be ${
        FORCE_LINKED
          ? "DELETED ANYWAY (--force-linked)"
          : "SKIPPED"
      }:`
    );

    for (const l of linked) {
      console.log(
        `   ${l.txn._id}  ₹${l.txn.amount}  ${
          l.txn.branch || ""
        }  ${l.txn.remarks || ""}`.trim()
      );

      for (const d of l.details) {
        console.log(
          `     -> ${d.kind} ${d.id}${
            d.otherPayments
              ? ` (${d.otherPayments} other payment(s) recorded against it — orphaning risk)`
              : ""
          }`
        );
      }
    }

    console.log("");
  }

  const toDelete = FORCE_LINKED ? matches : safe;

  console.log(
    `${toDelete.length} row(s) will be deleted${
      FORCE_LINKED
        ? ""
        : `; ${linked.length} skipped for being linked`
    }.\n`
  );

  if (!APPLY) {
    console.log("Sample rows (up to 15):");

    for (const t of toDelete.slice(0, 15)) {
      console.log(
        `   ${t._id}  ${
          t.date
            ? new Date(t.date)
                .toISOString()
                .slice(0, 10)
            : "—"
        }  ${
          t.branch || "—"
        }  ₹${t.amount}  ${
          t.expenseType || ""
        }  ${
          t.remarks || ""
        }`.trim()
      );
    }

    console.log(
      "\nDRY RUN — nothing deleted."
    );

    console.log(
      "Re-run with --apply to delete."
    );

    console.log(
      "Add --force-linked to also delete the linked rows above."
    );

    await mongoose.disconnect();

    return;
  }

  if (toDelete.length === 0) {
    console.log("Nothing to delete.");

    await mongoose.disconnect();

    return;
  }

  const ids = toDelete.map((t) => t._id);

  const result = await Transactions.deleteMany({
    _id: {
      $in: ids,
    },
  });

  console.log(
    `Deleted ${result.deletedCount} transaction(s).`
  );

  await mongoose.disconnect();

  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);

  await mongoose.disconnect().catch(() => {});

  process.exit(1);
});