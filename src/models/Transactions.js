import mongoose from "mongoose";
import { ALL_BRANCHES, COLLAB_BRANCHES } from "@/lib/branches";
// Registers the Patient model so the collabSplit validator below can read
// payments.totalAmount regardless of which route imported us first.
import "@/models/Patient";

const transactionSchema = new mongoose.Schema(
  {
    transactionCategory: {
      type: String,
      enum: ["TRANSPLANT", "SERVICE", "MEDICINE", "EXPENSE"],
    },

    batchId: {
      type: String,
      index: true,
    },

    patientName: {
      type: String,
    },
    patientPhone: {
      type: String,
    },

    quantity: {
      type: Number,
    },
    perSessionCost: {
      type: Number,
    },

    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stock",
    },
    perUnitCost: {
      type: Number,
    },

    expenseGiver: {
      type: {
        type: String,
        enum: ["VENDOR", "EMPLOYEE", "PATIENT", "MANUAL"],
      },
      // Unchanged, VENDOR only — kept for backwards compatibility.
      vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
      },
      // EMPLOYEE / PATIENT only — the corresponding Employee or Patient _id.
      refId: {
        type: mongoose.Schema.Types.ObjectId,
      },
      name: String,
    },

    // Set only when this expense is a payment against a Payable (pending-able
    // categories: Salary, Incentive, Rent, Electricity Bill, Collab Clinic
    // Payment, Patient Commission, Taxes). Null for every direct expense and
    // every non-EXPENSE transaction. Paid/pending on the Payable is always
    // computed by aggregating Transactions with this field set — see
    // src/models/Payable.js.
    payableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payable",
      index: true,
      default: null,
    },

    // Set only when this is a revenue transaction logged against a Receivable (money owed to us
    // arriving). Received/pending on the Receivable is always computed by aggregating Transactions
    // with this field set — see src/models/Receivable.js. Null for every other transaction.
    receivableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Receivable",
      index: true,
      default: null,
    },

    // TRUE when this transaction moves cash for a sale or cost whose P&L was ALREADY recognised
    // by a different transaction — a receipt against a receivable, a payment against a payable, a
    // collab settlement. The money genuinely moved, so it belongs in cash-account balances; the
    // revenue/expense was already booked at the point of sale, so counting it again in a total
    // double-counts the same rupee.
    //
    // Deliberately a separate flag rather than a `method` value: overloading method would lose
    // whether the cash arrived by cash/UPI/bank, which close-book account routing depends on.
    // See SETTLEMENT_EXCLUSION in src/constants/bankRouting.js for how totals filter on it, and
    // note it is NOT interchangeable with NON_CASH_METHODS or UNSETTLED_METHODS beside it.
    //
    // Defaults false, so every existing row keeps its current behaviour until explicitly set.
    isSettlement: { type: Boolean, default: false, index: true },

    // ── Reversals ────────────────────────────────────────────────────────────────────────
    //
    // A reversal is an ordinary transaction carrying a NEGATIVE amount and pointing at what it
    // reverses. Deliberately a negative amount rather than a flag with a positive one: `amount`
    // has no `min: 0`, so a negative row already nets out correctly in every existing
    // aggregation — revenue totals, account balances, patient amountReceived — without editing
    // a single one of them. A flag would require finding every sum in the codebase, and any one
    // missed is a silent wrong figure.
    //
    // NEVER created by the normal entry forms. Only POST /api/transactions/[id]/reverse writes
    // these, so a user cannot type "-500" into a routine entry and leave an untraceable mess.
    reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: "Transactions", default: null, index: true },
    // Set on the ORIGINAL, and only once it is FULLY reversed. A partially reversed original
    // stays false so it remains open to further reversal.
    isReversed: { type: Boolean, default: false },
    reversalReason: { type: String, default: "" },

    // FIFO split of THIS transaction's amount across more than one open receivable — set only
    // when a payment spilled over from one receivable into the next (see
    // src/lib/receivableAllocation.js). receivableId above is always kept equal to this array's
    // FIRST entry when the array is non-empty, so every pre-existing query keeps working. Empty
    // for every transaction the allocator didn't produce, including every historical row —
    // receivableAggregation.js falls back to the flat receivableId + full amount in that case.
    receivableAllocations: [
      {
        receivableId: { type: mongoose.Schema.Types.ObjectId, ref: "Receivable", required: true },
        amount: { type: Number, required: true, min: 0 },
      },
    ],

    // Supporting documents for this payment (invoice photo, bank slip, PDF receipt). Optional
    // everywhere, an array since more than one document can legitimately back a single payment.
    receipts: [
      {
        url: String,
        publicId: String,
        fileName: String,
        fileType: { type: String, enum: ["image", "pdf"] },
        uploadedBy: { name: String, email: String },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    // Collab (partner clinic) gross-revenue split. Populated ONLY when branch is a
    // COLLAB_BRANCHES clinic; left at these zero defaults for every main-branch and
    // non-collab transaction. Revenue is booked GROSS: a 50,000 package books 50,000
    // revenue and a 20,000 clinic-share expense — net margin 30,000. Never book the net.
    //
    //   ourShare + clinicShare    === Patient.payments.totalAmount  (the package)
    //   ourReceived + clinicReceived <= that same total
    //
    // *Received fields record WHO PHYSICALLY COLLECTED the money, not who earned it.
    // Money the patient paid the partner clinic (clinicReceived) deliberately does NOT
    // touch Patient.payments — see the revenue-recognition note in the pre-save hook.
    // Validated on save below; see src/lib/collabDerivation.js for what gets derived.
    collabSplit: {
      ourShare: { type: Number, default: 0 },
      clinicShare: { type: Number, default: 0 },
      ourReceived: { type: Number, default: 0 },
      clinicReceived: { type: Number, default: 0 },
    },

    // Set only when this transaction was generated by the collab clinic
    // flow. caseId links a transplant transaction back to the CollabCase it
    // was our-share revenue for (set immediately, at case-creation time, if
    // the patient paid us directly). settlementId links either direction's
    // transaction to the CollabSettlement that produced it (set when a
    // clinic settlement generates the transplant/expense transaction).
    // All null for every non-collab transaction.
    //
    // payableId/receivableId here are PROVENANCE links — "this revenue transaction
    // SPAWNED that payable/receivable" — and are deliberately NOT the same thing as
    // the top-level payableId/receivableId fields above, which mean "this transaction
    // is a PAYMENT against that document" and are what the paid/pending aggregations
    // sum. A collab revenue transaction must never set the top-level fields: doing so
    // would make the aggregation count the gross package as already settled the
    // instant the case is created.
    collabRef: {
      caseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CollabCase",
        index: true,
        default: null,
      },
      settlementId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CollabSettlement",
        index: true,
        default: null,
      },
      payableId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payable",
        index: true,
        default: null,
      },
      receivableId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Receivable",
        index: true,
        default: null,
      },
      // Marks the expense/offset-revenue rows crystalliseClinicShare itself writes when a case's
      // running total first reaches its package amount — see collabDerivation.js. Lets an unwind
      // (a reversed collection dropping the case back under its package) find exactly these rows
      // and no others, without guessing from remarks text.
      crystallisation: { type: Boolean, default: false },
    },

    // Set only when method is "paid_to_external" (revenue) or "paid_by_other" (expense) —
    // someone other than us physically handled the cash. The sale/cost is still booked in
    // full on this transaction; externalParty records who owes us (RECEIVED_BY) or who we
    // owe (PAID_BY) for it, and links to the Payable/Receivable created for that debt. Null
    // for every other transaction. See src/lib/externalPartyDerivation.js.
    externalParty: {
      direction: {
        type: String,
        enum: ["RECEIVED_BY", "PAID_BY"],
        default: null,
      },
      name: String,
      // The method the external party themselves used (or claims to have used) —
      // display-only context, distinct from this transaction's own top-level `method`.
      method: String,
      // Identity link, mirroring expenseGiver's type/refId pattern. MANUAL (typed name,
      // no backing record) is the fallback when the party isn't in Vendor/Employee/Patient.
      partyKind: {
        type: String,
        enum: ["VENDOR", "EMPLOYEE", "PATIENT", "MANUAL"],
        default: null,
      },
      partyRefId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
      linkedPayableId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payable",
        default: null,
      },
      linkedReceivableId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Receivable",
        default: null,
      },
    },

    // GST / TDS breakdown for an expense entered with "Include GST" and/or "Include TDS".
    // Null/absent on every transaction entered without them, so existing rows stay valid.
    //
    // GST is recorded here for audit and display ONLY — it never becomes a payable and
    // never gets its own transaction. It is embedded in invoiceTotal.
    // tdsAmount is always computed on baseAmount EXCLUDING GST — see src/lib/taxMath.js,
    // which is the single implementation shared with the entry forms.
    taxDetails: {
      baseAmount: Number,
      gstRate: Number,
      gstAmount: Number,
      invoiceTotal: Number,
      tdsApplied: { type: Boolean, default: false },
      tdsRate: Number,
      tdsAmount: Number,
      // The selected "TDS on ..." entry from the Taxes expense category.
      tdsCategory: String,
    },

    costType: {
      type: String,
      required: true,
      enum: ["Revenue", "Expenses"],
    },

    method: {
      type: String,
      enum: ["upi", "cash", "card", "banking", "bajaj_loan", "fibe_loan", "hdfc_skin_bank_transfer", "hdfc_ryan_medihub_bank_transfer", "icici_medihub_bank_transfer", "offset_settlement", "other", "including-package", "paid_to_external", "paid_by_other"],
    },

    // Receipt Mode: the intermediary/instrument money arrived through (e.g. "Paytm Delhi", "In Cash").
    // Further Mode: the destination account it lands in (e.g. "HDFC Skin", "Cash Book"). Revenue-side
    // fields only — distinct from the hdfc_*_bank_transfer / icici_medihub_bank_transfer method
    // values above, which describe money going OUT on expenses. See src/constants/bankRouting.js.
    receiptMode: { type: String, default: "" },
    furtherMode: { type: String, default: "" },

    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
    },

    procedure: {
      type: String,
      enum: [
        "Sapphire FUE",
        "DHI",
        "Turkish DHI",
        "Beard Transplant",
        "PRP",
        "Alopecia",
        "Headwash",
        "Canacot",
        "GFC",
        "Medicine",
        "Other",
      ],
    },

    paymentType: {
      type: String,
      enum: ["Booking", "Pending", "Full-payment", "Other"],
    },

    paymentId: String,

    branch: {
      type: String,
      enum: ALL_BRANCHES,
    },

    // Expense Category — top-level (e.g. "Marketing", "Incentive"). Only used for EXPENSE transactions.
    expense: String,
    // Transaction Type — sub-category under expense (e.g. "Meta ads" under "Marketing").
    // Left blank for categories with no sub-types. See src/constants/expenseCategories.js.
    expenseType: String,

    // Who a "Commision" expense is being paid to. Only ever set when
    // expense === "Commision"; left undefined for every other expense
    // category and for all non-EXPENSE transactions.
    // type values are the literal registered model names ("Patient"/"Employee")
    // so refPath resolves correctly on populate — "MANUAL" is a sentinel with
    // no backing model (never populated; `name` is used as the display value).
    commissionReceiver: {
      type: {
        type: String,
        enum: ["Patient", "Employee", "MANUAL"],
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "commissionReceiver.type",
      },
      name: { type: String, trim: true },
    },

    discount: {
      type: Number,
      default: 0,
    },

    amount: {
      type: Number,
      required: true,
    },

    date: {
      type: Date,
      default: Date.now,
    },

    expenseGiverOld: String,

    remarks: String,

    // WhatsApp approval workflow — only meaningful for EXPENSE transactions.
    // Every other category defaults to "APPROVED" so the get-all listing/stats
    // filters can apply a blanket approvalStatus exclusion without branching on category.
    approvalStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "APPROVED",
    },

    approvalActionBy: {
      name: String,
      phone: String,
      date: Date,
    },

    // wamid + admin phone for each approval request sent out, so the webhook
    // can tell the other admins "already actioned" once one of them responds.
    whatsappApprovalMessages: [
      {
        phone: String,
        messageId: String,
        sentAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    stock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stock",
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },

    editors: [
      {
        name: String,
        email: String,
        branch: String,
        date: {
          type: Date,
          default: Date.now,
        },
        updatedFields: [
          {
            name: String,
            previousValue: String,
            newValue: String,
          },
        ],
      },
    ],

    createdBy: {
      name: String,
      email: String,
      branch: String,
      date: {
        type: Date,
        default: Date.now,
      },
    },
  },
  { timestamps: true },
);

transactionSchema.pre("save", async function () {
  if (!this.transactionCategory) {
    if (this.costType === "Revenue") {
      if (
        ["Sapphire FUE", "DHI", "Turkish DHI", "Beard Transplant"].includes(
          this.procedure,
        )
      ) {
        this.transactionCategory = "TRANSPLANT";
      } else if (["PRP", "GFC" , "Alopecia", "Headwash", "Canacot",].includes(this.procedure)) {
        this.transactionCategory = "SERVICE";
      } else if (this.procedure === "Medicine") {
        this.transactionCategory = "MEDICINE";
      }
    } else if (this.costType === "Expenses") {
      this.transactionCategory = "EXPENSE";
    }
  }

  if (this.transactionCategory === "EXPENSE" && this.expenseGiver) {
    this.costType = "Expenses";
    const giverType = this.expenseGiver.type;
    this.expenseGiverOld =
      giverType === "VENDOR"
        ? `Vendor: ${this.expenseGiver.name}`
        : giverType === "EMPLOYEE"
          ? `Employee: ${this.expenseGiver.name}`
          : giverType === "PATIENT"
            ? `Patient: ${this.expenseGiver.name}`
            : this.expenseGiver.name;
  } else if (this.transactionCategory !== "EXPENSE") {
    this.costType = "Revenue";
  }
});

// Collab split invariants. Rejects with an explicit message rather than silently
// correcting — a wrong split is a real data-entry error and must surface, not be
// papered over. Runs only when collabSplit is actually populated, so every
// main-branch / non-collab save pays zero cost (no extra query).
//
// The package total is read from Patient.payments.totalAmount (derived from
// counselling.finlpackage by the Patient pre-save hook). It is READ ONLY here —
// this hook never writes back to Patient, and money the patient paid the partner
// clinic never advances the patient's payment status.
transactionSchema.pre("save", async function () {
  const split = this.collabSplit;
  if (!split) return;

  const ourShare = split.ourShare || 0;
  const clinicShare = split.clinicShare || 0;
  const ourReceived = split.ourReceived || 0;
  const clinicReceived = split.clinicReceived || 0;

  // Untouched defaults => not a collab-split transaction, nothing to validate.
  if (!ourShare && !clinicShare && !ourReceived && !clinicReceived) return;

  if (!COLLAB_BRANCHES.includes(this.branch)) {
    throw new Error(
      `collabSplit is only valid on collab clinic branches — "${this.branch}" is not one of: ${COLLAB_BRANCHES.join(", ")}`,
    );
  }

  const negatives = Object.entries({ ourShare, clinicShare, ourReceived, clinicReceived })
    .filter(([, v]) => v < 0)
    .map(([k]) => k);
  if (negatives.length > 0) {
    throw new Error(`collabSplit amounts cannot be negative: ${negatives.join(", ")}`);
  }

  if (!this.patient) {
    throw new Error("collabSplit requires a linked patient to validate against the package total");
  }

  const patient = await mongoose
    .model("Patient")
    .findById(this.patient)
    .select("payments.totalAmount")
    .lean();
  if (!patient) {
    throw new Error("collabSplit validation failed — linked patient not found");
  }

  const totalPackage = patient.payments?.totalAmount || 0;
  if (totalPackage <= 0) {
    throw new Error(
      "This patient has no final package set. Set the patient's package (counselling → final package) before creating a collab case.",
    );
  }

  // A discount is applied on top of the patient's package rather than editing it (see
  // CollabCaseForm / cases/create/route.js — both already split the NET, post-discount
  // figure). This transaction's own `discount` field is the same discount that split was
  // computed against, so it must net out here too — comparing against the untouched gross
  // totalPackage would reject every discounted collab case by exactly the discount amount.
  const discount = this.discount || 0;
  const netPackage = Math.round((totalPackage - discount) * 100) / 100;

  // Rupee amounts can carry paise; compare with a tolerance instead of ===.
  const EPSILON = 0.01;
  if (Math.abs(ourShare + clinicShare - netPackage) > EPSILON) {
    throw new Error(
      `Collab split must equal the package total: ourShare (${ourShare}) + clinicShare (${clinicShare}) = ${ourShare + clinicShare}, but the package is ${totalPackage}${discount ? ` minus a discount of ${discount} = ${netPackage}` : ""}`,
    );
  }

  if (ourReceived + clinicReceived - netPackage > EPSILON) {
    throw new Error(
      `Collected amount exceeds the package: ourReceived (${ourReceived}) + clinicReceived (${clinicReceived}) = ${ourReceived + clinicReceived}, but the package is only ${netPackage}`,
    );
  }
});

transactionSchema.virtual("medicineDetails", {
  ref: "Stock",
  localField: "medicineId",
  foreignField: "_id",
  justOne: true,
});

transactionSchema.virtual("patientDetails", {
  ref: "Patient",
  localField: "patient",
  foreignField: "_id",
  justOne: true,
});

transactionSchema.virtual("vendorDetails", {
  ref: "Vendor",
  localField: "expenseGiver.vendorId",
  foreignField: "_id",
  justOne: true,
});

transactionSchema.set("toJSON", { virtuals: true });
transactionSchema.set("toObject", { virtuals: true });

transactionSchema.index({ date: -1 });
transactionSchema.index({ costType: 1, date: -1 });
transactionSchema.index({ branch: 1, date: -1 });
transactionSchema.index({ branch: 1, costType: 1, date: -1 });
transactionSchema.index({ patient: 1 });
transactionSchema.index({ approvalStatus: 1, date: -1 });

// Close-book / balance-sheet access paths. The account ledger and balance sheet always
// filter on furtherMode + a date range, so that pair leads. Verified in use with
// .explain() — see the close-book verification notes.
transactionSchema.index({ furtherMode: 1, date: 1 });
transactionSchema.index({ approvalStatus: 1, date: 1 });
// Balance aggregation access path: every balance query filters approvalStatus, then splits
// revenue from expense by costType, over a date range. Equality keys lead, range key last.
transactionSchema.index({ approvalStatus: 1, costType: 1, date: 1 });
// Ledger filtered by payment method within a period, newest first.
transactionSchema.index({ date: -1, method: 1 });
transactionSchema.index({ branch: 1, transactionCategory: 1, date: -1 });

export default mongoose.models.Transactions ||
  mongoose.model("Transactions", transactionSchema);
