import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Patient from "@/models/Patient";
import Employee from "@/models/Employee";
import Transactions from "@/models/Transactions";
import Stock from "@/models/Stock";
import Vendor from "@/models/Vendor";
import Payable from "@/models/Payable";
import Receivable from "@/models/Receivable";
import { buildPayableAggregationStages } from "@/lib/payableAggregation";
import { buildReceivableAggregationStages } from "@/lib/receivableAggregation";
import { ALL_BRANCHES, COLLAB_BRANCHES } from "@/lib/branches";
import { UNSETTLED_METHODS, SETTLEMENT_EXCLUSION } from "@/constants/bankRouting";

// Whether `branchName` (a plain branch string) is covered by `branchFilter`, which may be
// undefined/empty (no restriction), a plain string (exact match), or a Mongo `{ $in: [...] }`.
function branchAllowed(branchFilter, branchName) {
  if (!branchFilter) return true;
  if (typeof branchFilter === "string") return branchFilter === branchName;
  if (branchFilter.$in) return branchFilter.$in.includes(branchName);
  return true;
}

export async function GET(request) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized. Please login." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const requestedBranch = searchParams.get("branch");

    // Scope the branch filter to what this role/session is allowed to see.
    // admin/super-admin: unrestricted (whatever was requested, or none).
    // collab: always limited to the 8 collab-city set.
    // reception (and any other single-branch role): pinned to their own branch.
    let branch = requestedBranch || undefined;
    const role = session.user.role;
    const userBranch = session.user.branch;
    if (role === "collab") {
      branch = requestedBranch && COLLAB_BRANCHES.includes(requestedBranch)
        ? requestedBranch
        : { $in: COLLAB_BRANCHES };
    } else if (!["admin", "super-admin"].includes(role) && userBranch && userBranch !== "All") {
      branch = userBranch;
    }

    const staffFilter = searchParams.get("staffFilter");
    const techniqueFilter = searchParams.get("techniqueFilter");
    const statusFilter = searchParams.get("statusFilter");
    const procedureFilter = searchParams.get("procedureFilter");
    const paymentTypeFilter = searchParams.get("paymentTypeFilter");

    let data = [];

    const allEmployees = await Employee.find(
      { isactive: true },
      { name: 1, role: 1, email: 1, phone: 1, _id: 1 }
    ).lean();
    const employeesByRole = {
      counsellors: allEmployees.filter(e => e.role === "Counsellor"),
      agents:      allEmployees.filter(e => e.role === "Agent"),
      doctors:     allEmployees.filter(e => e.role === "Doctor"),
      implanters:  allEmployees.filter(e => e.role === "Implanter"),
      technicians: allEmployees.filter(e => e.role === "Technician"),
    };

    // Build separate date filters for patient vs transaction collections.
    // Patients are filtered by personal.visitDate; transactions by their date field.
    const patientDateFilter = {};
    const transactionDateFilter = {};
    // Payable/Receivable have no "transaction date" of their own — createdAt is when the
    // obligation was RAISED, the same field the Liabilities/Assets pages filter and roll up by.
    const obligationDateFilter = {};
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      patientDateFilter["personal.visitDate"] = { $gte: fromDate, $lte: toDate };
      transactionDateFilter["date"] = { $gte: fromDate, $lte: toDate };
      obligationDateFilter["createdAt"] = { $gte: fromDate, $lte: toDate };
    }

    switch (type) {
      // ==================== PATIENT REPORTS ====================
      case "patients-comprehensive":
        data = await generateComprehensivePatientReport({
          dateFilter: patientDateFilter,
          branch,
          staffFilter,
          techniqueFilter,
          statusFilter,
        });
        break;

      case "patients-demographics":
        data = await generateDemographicsReport({ dateFilter: patientDateFilter, branch });
        break;

      case "patients-status":
        data = await generateStatusReport({ dateFilter: patientDateFilter, branch, statusFilter });
        break;

      case "patients-medical":
        data = await generateMedicalHistoryReport({ dateFilter: patientDateFilter, branch });
        break;

      case "patients-surgery":
        data = await generateSurgeryScheduleReport({ dateFilter: patientDateFilter, branch, staffFilter });
        break;

      case "patients-counselling":
        data = await generateCounsellingOutcomesReport({ dateFilter: patientDateFilter, branch, staffFilter });
        break;

      case "outstanding-payments":
        data = await generateOutstandingPaymentsReport({
          dateFilter: patientDateFilter,
          branch,
          statusFilter,
        });
        break;

      case "grafts-analysis":
        data = await generateGraftsAnalysisReport({
          dateFilter: patientDateFilter,
          branch,
          techniqueFilter,
        });
        break;

      // ==================== STAFF REPORTS ====================
      case "employees-all":
        data = await generateEmployeesAllReport();
        break;

      case "counsellors":
        data = await generateCounsellorReport({
          dateFilter: patientDateFilter,
          branch,
          staffFilter,
          employees: employeesByRole.counsellors,
        });
        break;

      case "agents":
        data = await generateAgentReport({ dateFilter: patientDateFilter, branch, staffFilter, employees: employeesByRole.agents });
        break;

      case "doctors":
        data = await generateDoctorReport({
          dateFilter: patientDateFilter,
          branch,
          staffFilter,
          techniqueFilter,
          employees: employeesByRole.doctors,
        });
        break;

      case "implanters":
        data = await generateImplanterReport({
          dateFilter: patientDateFilter,
          branch,
          staffFilter,
          employees: employeesByRole.implanters,
        });
        break;

      case "technicians":
        data = await generateTechnicianReport({
          dateFilter: patientDateFilter,
          branch,
          staffFilter,
          employees: employeesByRole.technicians,
        });
        break;

      // ==================== MEDICAL REPORTS ====================
      case "techniques":
        data = await generateTechniqueReport({
          dateFilter: patientDateFilter,
          branch,
          techniqueFilter,
        });
        break;

      case "surgery-schedule":
        data = await generateSurgeryScheduleReport({
          dateFilter: patientDateFilter,
          branch,
          staffFilter,
        });
        break;

      case "counselling-outcomes":
        data = await generateCounsellingOutcomesReport({
          dateFilter: patientDateFilter,
          branch,
          staffFilter,
        });
        break;

      // ==================== FINANCIAL REPORTS ====================
      case "revenue":
        data = await generateRevenueReport({
          dateFilter: transactionDateFilter,
          branch,
          procedureFilter,
          paymentTypeFilter,
        });
        break;

      case "expenses":
        data = await generateExpensesReport({ dateFilter: transactionDateFilter, branch });
        break;

      case "transactions":
      case "transactions-all":
        data = await generateTransactionsReport({
          dateFilter: transactionDateFilter,
          branch,
          procedureFilter,
          paymentTypeFilter,
        });
        break;

      case "payment-collection":
        data = await generatePaymentCollectionReport({
          dateFilter: transactionDateFilter,
          branch,
          staffFilter,
        });
        break;

      case "procedure-revenue":
        data = await generateProcedureRevenueReport({
          dateFilter: transactionDateFilter,
          branch,
          procedureFilter,
        });
        break;

      case "payables-all":
        data = await generatePayablesAllReport({ dateFilter: obligationDateFilter, branch });
        break;

      case "receivables-all":
        data = await generateReceivablesAllReport({ dateFilter: obligationDateFilter, branch });
        break;

      // ==================== BRANCH REPORTS ====================
      case "branch-comparison":
        data = await generateBranchComparisonReport({ patientDateFilter, transactionDateFilter, branch });
        break;

      case "branch-revenue":
        data = await generateBranchRevenueReport({ dateFilter: transactionDateFilter, branch });
        break;

      case "branch-patients":
        data = await generateBranchPatientsReport({ dateFilter: patientDateFilter, branch });
        break;

      // ==================== INVENTORY REPORTS ====================
      case "stocks-all":
        data = await generateStocksAllReport();
        break;

      case "vendors-all":
        data = await generateVendorsAllReport();
        break;

      default:
        return new Response(
          JSON.stringify({ success: false, message: "Invalid report type" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Report generation error:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// ==================== REPORT GENERATION FUNCTIONS ====================

async function generateComprehensivePatientReport(filters) {
  const query = { ...filters.dateFilter };
  if (filters.branch) query["personal.branch"] = filters.branch;
  if (filters.statusFilter) query["ops.status"] = filters.statusFilter;

  let patients = await Patient.find(query, {
    "documents.images": 0,
    "documents.consentForm": 0,
    "documents.suregeryForm": 0,
    "documents.consultForm": 0,
    "afterSurgery": 0,
    "products": 0,
    "editors": 0,
  })
    .populate("personal.reference", "name role")
    .populate("counselling.counsellor", "name")
    .populate("surgery.doctor", "name")
    .populate("surgery.seniorTech", "name")
    .populate("surgery.implanterRight", "name")
    .populate("surgery.implanterLeft", "name")
    .limit(5000)
    .lean();

  if (filters.staffFilter) {
    patients = patients.filter(
      (p) =>
        p.personal?.reference?.name === filters.staffFilter ||
        p.counselling?.counsellor?.name === filters.staffFilter ||
        p.surgery?.doctor?.name === filters.staffFilter
    );
  }

  if (filters.techniqueFilter) {
    patients = patients.filter(
      (p) =>
        p.counselling?.techniqueSuggested === filters.techniqueFilter ||
        p.surgery?.technique === filters.techniqueFilter
    );
  }

  return patients.map((p) => ({
    "Patient ID": p._id?.toString() || "",
    "Patient Name": p.personal?.name || "",
    Phone: p.personal?.phone || "",
    Email: p.personal?.email || "",
    Age: p.personal?.age || "",
    Gender: p.personal?.gender || "",
    Branch: p.personal?.branch || "",
    Address: p.personal?.address || "",
    Profession: p.personal?.profession || "",
    "Visit Date": p.personal?.visitDate
      ? new Date(p.personal.visitDate).toLocaleDateString()
      : "",
    "Reference Agent": p.personal?.reference?.name || "",
    "Package Quoted": p.personal?.packageQuoted || "",
    "Technique Quoted": p.personal?.techniqueQuoted || "",
    "Blood Group": p.medical?.bloodGroup || "",
    Allergies: p.medical?.allergies || "",
    "Medical History": p.medical?.medicalHistory || "",
    Counsellor: p.counselling?.counsellor?.name || "",
    "Technique Suggested": p.counselling?.techniqueSuggested || "",
    "Final Package": p.counselling?.finlpackage || "",
    "Grafts Suggested": p.counselling?.graftsSuggested || "",
    "Ready For Surgery": p.counselling?.readyForSurgery ? "Yes" : "No",
    "Surgery Date": p.surgery?.surgeryDate
      ? new Date(p.surgery.surgeryDate).toLocaleDateString()
      : "",
    "Surgery Location": p.surgery?.location || "",
    "Surgery Technique": p.surgery?.technique || "",
    "Grafts Implanted": p.surgery?.graftsImplanted || "",
    Doctor: p.surgery?.doctor?.name || "",
    "Senior Technician": p.surgery?.seniorTech?.name || "",
    "Implanter Right": p.surgery?.implanterRight?.name || "",
    "Implanter Left": p.surgery?.implanterLeft?.name || "",
    "Total Amount": p.payments?.totalAmount || 0,
    "Amount Received": p.payments?.amountReceived || 0,
    "Pending Amount": p.payments?.pendingAmount || 0,
    Status: p.ops?.status || "",
    "Created At": p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "",
  }));
}

async function generateDemographicsReport(filters) {
  const query = { ...filters.dateFilter };
  if (filters.branch) query["personal.branch"] = filters.branch;

  const patients = await Patient.find(query, {
    "personal.name": 1,
    "personal.phone": 1,
    "personal.age": 1,
    "personal.gender": 1,
    "personal.profession": 1,
    "personal.branch": 1,
    "personal.address": 1,
    "personal.visitDate": 1,
  }).limit(5000).lean();

  return patients.map((p) => ({
    "Patient ID": p._id?.toString() || "",
    "Patient Name": p.personal?.name || "",
    Phone: p.personal?.phone || "",
    Age: p.personal?.age || "",
    Gender: p.personal?.gender || "",
    Profession: p.personal?.profession || "",
    Branch: p.personal?.branch || "",
    Address: p.personal?.address || "",
    "Visit Date": p.personal?.visitDate
      ? new Date(p.personal.visitDate).toLocaleDateString()
      : "",
  }));
}

async function generateStatusReport(filters) {
  const query = { ...filters.dateFilter };
  if (filters.branch) query["personal.branch"] = filters.branch;
  if (filters.statusFilter) query["ops.status"] = filters.statusFilter;

  const patients = await Patient.find(query, {
    "personal.name": 1,
    "personal.phone": 1,
    "personal.branch": 1,
    "personal.visitDate": 1,
    "personal.reference": 1,
    "ops.status": 1,
    "updatedAt": 1,
  })
    .populate("personal.reference", "name")
    .limit(5000)
    .lean();

  return patients.map((p) => ({
    "Patient ID": p._id?.toString() || "",
    "Patient Name": p.personal?.name || "",
    Phone: p.personal?.phone || "",
    Branch: p.personal?.branch || "",
    Status: p.ops?.status || "",
    "Visit Date": p.personal?.visitDate
      ? new Date(p.personal.visitDate).toLocaleDateString()
      : "",
    "Reference Agent": p.personal?.reference?.name || "",
    "Days in Current Status": p.updatedAt
      ? Math.floor((new Date() - new Date(p.updatedAt)) / (1000 * 60 * 60 * 24))
      : "",
  }));
}

async function generateMedicalHistoryReport(filters) {
  const query = { ...filters.dateFilter };
  if (filters.branch) query["personal.branch"] = filters.branch;

  const patients = await Patient.find(query, {
    "personal.name": 1,
    "personal.phone": 1,
    "personal.age": 1,
    "personal.gender": 1,
    "medical": 1,
  }).limit(5000).lean();

  return patients.map((p) => ({
    "Patient ID": p._id?.toString() || "",
    "Patient Name": p.personal?.name || "",
    Phone: p.personal?.phone || "",
    Age: p.personal?.age || "",
    Gender: p.personal?.gender || "",
    "Blood Group": p.medical?.bloodGroup || "",
    Allergies: p.medical?.allergies || "",
    "Medical History": p.medical?.medicalHistory || "",
    Sugar: p.medical?.sugar || "",
    "Blood Pressure": p.medical?.bp || "",
    Pulse: p.medical?.pulse || "",
    Weight: p.medical?.weight || "",
    HIV: p.medical?.hiv || "",
    HCV: p.medical?.hcv || "",
  }));
}

async function generateCounsellorReport(filters) {
  const counsellors = filters.employees || [];

  const query = { ...filters.dateFilter };
  if (filters.branch) query["personal.branch"] = filters.branch;

  const patients = await Patient.find(query, {
    "personal.branch": 1,
    "counselling.counsellor": 1,
    "counselling.readyForSurgery": 1,
    "counselling.finlpackage": 1,
  })
    .populate("counselling.counsellor", "name")
    .limit(5000)
    .lean();

  const counsellorStats = {};

  counsellors.forEach((c) => {
    counsellorStats[c._id.toString()] = {
      "Counsellor Name": c.name,
      Email: c.email || "",
      Phone: c.phone || "",
      "Total Patients": 0,
      "Ready for Surgery": 0,
      "Not Ready": 0,
      "Conversion Rate": "0%",
      "Total Package Value": 0,
      "Avg Package Value": 0,
    };
  });

  patients.forEach((p) => {
    const counsellorId = p.counselling?.counsellor?._id?.toString();
    if (counsellorId && counsellorStats[counsellorId]) {
      counsellorStats[counsellorId]["Total Patients"]++;
      if (p.counselling?.readyForSurgery) {
        counsellorStats[counsellorId]["Ready for Surgery"]++;
      } else {
        counsellorStats[counsellorId]["Not Ready"]++;
      }
      if (p.counselling?.finlpackage) {
        counsellorStats[counsellorId]["Total Package Value"] +=
          p.counselling.finlpackage;
      }
    }
  });

  Object.keys(counsellorStats).forEach((id) => {
    const stats = counsellorStats[id];
    if (stats["Total Patients"] > 0) {
      stats["Conversion Rate"] =
        ((stats["Ready for Surgery"] / stats["Total Patients"]) * 100).toFixed(
          1
        ) + "%";
      stats["Avg Package Value"] = Math.round(
        stats["Total Package Value"] / stats["Total Patients"]
      );
    }
  });

  return Object.values(counsellorStats).filter((s) => s["Total Patients"] > 0);
}

async function generateAgentReport(filters) {
  const agents = filters.employees || [];

  const query = { ...filters.dateFilter };
  if (filters.branch) query["personal.branch"] = filters.branch;

  const patients = await Patient.find(query, {
    "personal.reference": 1,
    "personal.branch": 1,
    "ops.status": 1,
    "payments.amountReceived": 1,
  })
    .populate("personal.reference", "name")
    .limit(5000)
    .lean();

  const agentStats = {};

  agents.forEach((a) => {
    agentStats[a._id.toString()] = {
      "Agent Name": a.name,
      Email: a.email || "",
      Phone: a.phone || "",
      "Total Referrals": 0,
      "Converted to Surgery": 0,
      "Conversion Rate": "0%",
      "Total Revenue Generated": 0,
    };
  });

  patients.forEach((p) => {
    const agentId = p.personal?.reference?._id?.toString();
    if (agentId && agentStats[agentId]) {
      agentStats[agentId]["Total Referrals"]++;
      if (p.ops?.status === "POST_OP" || p.ops?.status === "CLOSED") {
        agentStats[agentId]["Converted to Surgery"]++;
        if (p.payments?.amountReceived) {
          agentStats[agentId]["Total Revenue Generated"] +=
            p.payments.amountReceived;
        }
      }
    }
  });

  Object.keys(agentStats).forEach((id) => {
    const stats = agentStats[id];
    if (stats["Total Referrals"] > 0) {
      stats["Conversion Rate"] =
        (
          (stats["Converted to Surgery"] / stats["Total Referrals"]) *
          100
        ).toFixed(1) + "%";
    }
  });

  return Object.values(agentStats).filter((s) => s["Total Referrals"] > 0);
}

async function generateDoctorReport(filters) {
  const doctors = filters.employees || [];

  const query = { ...filters.dateFilter };
  if (filters.branch) query["personal.branch"] = filters.branch;
  if (filters.techniqueFilter)
    query["surgery.technique"] = filters.techniqueFilter;

  const patients = await Patient.find(query, {
    "personal.branch": 1,
    "surgery.doctor": 1,
    "surgery.surgeryDate": 1,
    "surgery.technique": 1,
    "surgery.graftsImplanted": 1,
  })
    .populate("surgery.doctor", "name")
    .limit(5000)
    .lean();

  const doctorStats = {};

  doctors.forEach((d) => {
    doctorStats[d._id.toString()] = {
      "Doctor Name": d.name,
      Email: d.email || "",
      Phone: d.phone || "",
      "Total Surgeries": 0,
      "Total Grafts Implanted": 0,
      "Avg Grafts per Surgery": 0,
      "FUE Count": 0,
      "DHI Count": 0,
      "INDIAN DHI Count": 0,
      "HYBRID Count": 0,
    };
  });

  patients.forEach((p) => {
    const doctorId = p.surgery?.doctor?._id?.toString();
    if (doctorId && doctorStats[doctorId] && p.surgery?.surgeryDate) {
      doctorStats[doctorId]["Total Surgeries"]++;
      if (p.surgery?.graftsImplanted) {
        doctorStats[doctorId]["Total Grafts Implanted"] +=
          p.surgery.graftsImplanted;
      }
      if (p.surgery?.technique) {
        const technique = p.surgery.technique;
        if (technique === "FUE") doctorStats[doctorId]["FUE Count"]++;
        else if (technique === "DHI") doctorStats[doctorId]["DHI Count"]++;
        else if (technique === "INDIAN DHI")
          doctorStats[doctorId]["INDIAN DHI Count"]++;
        else if (technique === "HYBRID")
          doctorStats[doctorId]["HYBRID Count"]++;
      }
    }
  });

  Object.keys(doctorStats).forEach((id) => {
    const stats = doctorStats[id];
    if (stats["Total Surgeries"] > 0) {
      stats["Avg Grafts per Surgery"] = Math.round(
        stats["Total Grafts Implanted"] / stats["Total Surgeries"]
      );
    }
  });

  return Object.values(doctorStats).filter((s) => s["Total Surgeries"] > 0);
}

async function generateImplanterReport(filters) {
  const implanters = filters.employees || [];

  const query = { ...filters.dateFilter };
  if (filters.branch) query["personal.branch"] = filters.branch;

  const patients = await Patient.find(query, {
    "personal.branch": 1,
    "surgery.implanterRight": 1,
    "surgery.implanterLeft": 1,
    "surgery.surgeryDate": 1,
    "surgery.graftsImplanted": 1,
  })
    .populate("surgery.implanterRight", "name")
    .populate("surgery.implanterLeft", "name")
    .limit(5000)
    .lean();

  const implanterStats = {};

  implanters.forEach((i) => {
    implanterStats[i._id.toString()] = {
      "Implanter Name": i.name,
      Email: i.email || "",
      Phone: i.phone || "",
      "Total Procedures": 0,
      "Total Grafts Implanted": 0,
      "Avg Grafts per Procedure": 0,
    };
  });

  patients.forEach((p) => {
    if (p.surgery?.surgeryDate) {
      const rightId = p.surgery?.implanterRight?._id?.toString();
      const leftId = p.surgery?.implanterLeft?._id?.toString();
      const grafts = p.surgery?.graftsImplanted || 0;

      [rightId, leftId].forEach((id) => {
        if (id && implanterStats[id]) {
          implanterStats[id]["Total Procedures"]++;
          implanterStats[id]["Total Grafts Implanted"] += grafts / 2; // Split grafts between both
        }
      });
    }
  });

  Object.keys(implanterStats).forEach((id) => {
    const stats = implanterStats[id];
    if (stats["Total Procedures"] > 0) {
      stats["Avg Grafts per Procedure"] = Math.round(
        stats["Total Grafts Implanted"] / stats["Total Procedures"]
      );
    }
  });

  return Object.values(implanterStats).filter((s) => s["Total Procedures"] > 0);
}

async function generateTechnicianReport(filters) {
  const technicians = filters.employees || [];

  const query = { ...filters.dateFilter };
  if (filters.branch) query["personal.branch"] = filters.branch;

  const patients = await Patient.find(query, {
    "personal.branch": 1,
    "surgery.seniorTech": 1,
    "surgery.graftingPerson": 1,
    "surgery.helper": 1,
    "surgery.surgeryDate": 1,
  })
    .populate("surgery.seniorTech", "name")
    .populate("surgery.graftingPerson", "name")
    .populate("surgery.helpers", "name")
    .limit(5000)
    .lean();

  const techStats = {};

  technicians.forEach((t) => {
    techStats[t._id.toString()] = {
      "Technician Name": t.name,
      Email: t.email || "",
      Phone: t.phone || "",
      "Total Procedures": 0,
      "As Senior Tech": 0,
      "As Grafting Person": 0,
      "As Helper": 0,
    };
  });

  patients.forEach((p) => {
    if (p.surgery?.surgeryDate) {
      const seniorId = p.surgery?.seniorTech?._id?.toString();
      const graftingId = p.surgery?.graftingPerson?._id?.toString();
      const helpers = p.surgery?.helpers || []; // ✅ Get helpers array

      if (seniorId && techStats[seniorId]) {
        techStats[seniorId]["Total Procedures"]++;
        techStats[seniorId]["As Senior Tech"]++;
      }
      if (graftingId && techStats[graftingId]) {
        techStats[graftingId]["Total Procedures"]++;
        techStats[graftingId]["As Grafting Person"]++;
      }

      // ✅ Loop through ALL helpers
      helpers.forEach((helper) => {
        const helperId = helper?._id?.toString();
        if (helperId && techStats[helperId]) {
          techStats[helperId]["Total Procedures"]++;
          techStats[helperId]["As Helper"]++;
        }
      });
    }
  });
  return Object.values(techStats).filter((s) => s["Total Procedures"] > 0);
}

async function generateTechniqueReport(filters) {
  const query = { ...filters.dateFilter };
  if (filters.branch) query["personal.branch"] = filters.branch;
  if (filters.techniqueFilter)
    query["surgery.technique"] = filters.techniqueFilter;

  const patients = await Patient.find(query, {
    "personal.branch": 1,
    "surgery.technique": 1,
    "surgery.surgeryDate": 1,
    "surgery.graftsImplanted": 1,
    "payments.amountReceived": 1,
  }).limit(5000).lean();

  const techniques = {};

  patients.forEach((p) => {
    if (p.surgery?.technique && p.surgery?.surgeryDate) {
      const tech = p.surgery.technique;
      if (!techniques[tech]) {
        techniques[tech] = {
          Technique: tech,
          "Total Surgeries": 0,
          "Total Grafts": 0,
          "Avg Grafts": 0,
          "Total Revenue": 0,
          "Avg Revenue": 0,
        };
      }
      techniques[tech]["Total Surgeries"]++;
      if (p.surgery.graftsImplanted) {
        techniques[tech]["Total Grafts"] += p.surgery.graftsImplanted;
      }
      if (p.payments?.amountReceived) {
        techniques[tech]["Total Revenue"] += p.payments.amountReceived;
      }
    }
  });

  Object.keys(techniques).forEach((tech) => {
    const stats = techniques[tech];
    if (stats["Total Surgeries"] > 0) {
      stats["Avg Grafts"] = Math.round(
        stats["Total Grafts"] / stats["Total Surgeries"]
      );
      stats["Avg Revenue"] = Math.round(
        stats["Total Revenue"] / stats["Total Surgeries"]
      );
    }
  });

  return Object.values(techniques);
}

async function generateSurgeryScheduleReport(filters) {
  const query = {
    ...filters.dateFilter,
    "surgery.surgeryDate": { $exists: true },
  };
  if (filters.branch) query["personal.branch"] = filters.branch;

  const patients = await Patient.find(query, {
    "personal.name": 1,
    "personal.phone": 1,
    "personal.branch": 1,
    "surgery.surgeryDate": 1,
    "surgery.location": 1,
    "surgery.technique": 1,
    "surgery.graftsneed": 1,
    "surgery.doctor": 1,
    "surgery.seniorTech": 1,
    "surgery.implanterRight": 1,
    "surgery.implanterLeft": 1,
    "ops.status": 1,
  })
    .populate("surgery.doctor", "name")
    .populate("surgery.seniorTech", "name")
    .populate("surgery.implanterRight", "name")
    .populate("surgery.implanterLeft", "name")
    .sort({ "surgery.surgeryDate": 1 })
    .limit(5000)
    .lean();

  return patients.map((p) => ({
    "Surgery Date": p.surgery?.surgeryDate
      ? new Date(p.surgery.surgeryDate).toLocaleDateString()
      : "",
    "Patient Name": p.personal?.name || "",
    Phone: p.personal?.phone || "",
    Branch: p.personal?.branch || "",
    "Surgery Location": p.surgery?.location || "",
    Technique: p.surgery?.technique || "",
    "Grafts Needed": p.surgery?.graftsneed || "",
    Doctor: p.surgery?.doctor?.name || "",
    "Senior Tech": p.surgery?.seniorTech?.name || "",
    "Implanter Right": p.surgery?.implanterRight?.name || "",
    "Implanter Left": p.surgery?.implanterLeft?.name || "",
    Status: p.ops?.status || "",
  }));
}

async function generateGraftsAnalysisReport(filters) {
  const query = {
    ...filters.dateFilter,
    "surgery.surgeryDate": { $exists: true },
  };
  if (filters.branch) query["personal.branch"] = filters.branch;
  if (filters.techniqueFilter)
    query["surgery.technique"] = filters.techniqueFilter;

  const patients = await Patient.find(query, {
    "personal.name": 1,
    "personal.phone": 1,
    "personal.branch": 1,
    "surgery.technique": 1,
    "surgery.surgeryDate": 1,
    "surgery.graftsneed": 1,
    "surgery.graftsImplanted": 1,
    "counselling.graftsSuggested": 1,
  }).limit(5000).lean();

  return patients.map((p) => ({
    "Patient Name": p.personal?.name || "",
    Phone: p.personal?.phone || "",
    Branch: p.personal?.branch || "",
    Technique: p.surgery?.technique || "",
    "Grafts Suggested": p.counselling?.graftsSuggested || 0,
    "Grafts Needed": p.surgery?.graftsneed || 0,
    "Grafts Implanted": p.surgery?.graftsImplanted || 0,
    "Variance (Suggested vs Implanted)":
      (p.surgery?.graftsImplanted || 0) - (p.counselling?.graftsSuggested || 0),
    "Implantation Rate": p.surgery?.graftsneed
      ? ((p.surgery.graftsImplanted / p.surgery.graftsneed) * 100).toFixed(1) +
        "%"
      : "N/A",
    "Surgery Date": p.surgery?.surgeryDate
      ? new Date(p.surgery.surgeryDate).toLocaleDateString()
      : "",
  }));
}

async function generateCounsellingOutcomesReport(filters) {
  const query = { ...filters.dateFilter };
  if (filters.branch) query["personal.branch"] = filters.branch;

  const patients = await Patient.find(query, {
    "personal.name": 1,
    "personal.phone": 1,
    "personal.branch": 1,
    "counselling": 1,
    "ops.status": 1,
  })
    .populate("counselling.counsellor", "name")
    .limit(5000)
    .lean();

  return patients.map((p) => ({
    "Patient Name": p.personal?.name || "",
    Phone: p.personal?.phone || "",
    Branch: p.personal?.branch || "",
    Counsellor: p.counselling?.counsellor?.name || "",
    "Technique Suggested": p.counselling?.techniqueSuggested || "",
    "Grafts Suggested": p.counselling?.graftsSuggested || "",
    "Package Amount": p.counselling?.finlpackage || "",
    "Ready for Surgery": p.counselling?.readyForSurgery ? "Yes" : "No",
    "Medicines Prescribed": p.counselling?.medicines?.join(", ") || "",
    "Hair Loss Type": p.counselling?.hairlossType || "",
    "Area of Concern": p.counselling?.areaofConcern || "",
    "Hair Loss Reason": p.counselling?.hairlossreason || "",
    "Hair Loss Duration": p.counselling?.hairlossduration || "",
    Status: p.ops?.status || "",
  }));
}

async function generateRevenueReport(filters) {
  const query = {
    ...filters.dateFilter,
    costType: "Revenue",
  };
  if (filters.branch) query.branch = filters.branch;
  if (filters.procedureFilter) query.procedure = filters.procedureFilter;
  if (filters.paymentTypeFilter) query.paymentType = filters.paymentTypeFilter;

  const transactions = await Transactions.find(query)
    .populate("patient", "personal.name personal.phone")
    .sort({ date: -1 })
    .limit(5000)
    .lean();

  return transactions.map((t) => ({
    Date: t.date ? new Date(t.date).toLocaleDateString() : "",
    "Patient Name": t.patient?.personal?.name || "",
    "Patient Phone": t.patient?.personal?.phone || "",
    Branch: t.branch || "",
    Procedure: t.procedure || "",
    "Payment Type": t.paymentType || "",
    "Payment Method": t.method || "",
    Amount: t.amount || 0,
    Remarks: t.remarks || "",
  }));
}

async function generateExpensesReport(filters) {
  const query = {
    ...filters.dateFilter,
    costType: "Expenses",
  };
  if (filters.branch) query.branch = filters.branch;

  const transactions = await Transactions.find(query).sort({ date: -1 }).limit(5000).lean();

  return transactions.map((t) => ({
    Date: t.date ? new Date(t.date).toLocaleDateString() : "",
    Branch: t.branch || "",
    "Expense Category": t.expense || "",
    "Expense Type": t.expenseType || "",
    "Payment Method": t.method || "",
    Amount: t.amount || 0,
    Remarks: t.remarks || "",
  }));
}

async function generateTransactionsReport(filters) {
  const query = { ...filters.dateFilter };
  if (filters.branch) query.branch = filters.branch;
  if (filters.procedureFilter) query.procedure = filters.procedureFilter;
  if (filters.paymentTypeFilter) query.paymentType = filters.paymentTypeFilter;

  const transactions = await Transactions.find(query)
    .populate("patient", "personal.name personal.phone")
    .sort({ date: -1 })
    .limit(5000)
    .lean();

  return transactions.map((t) => ({
    Date: t.date ? new Date(t.date).toLocaleDateString() : "",
    "Cost Type": t.costType || "",
    Branch: t.branch || "",
    "Patient Name": t.patient?.personal?.name || "N/A",
    "Patient Phone": t.patient?.personal?.phone || "N/A",
    Procedure: t.procedure || "N/A",
    "Payment Type": t.paymentType || "N/A",
    "Expense Category": t.expense || "N/A",
    "Expense Type": t.expenseType || "N/A",
    "Payment Method": t.method || "",
    Amount: t.amount || 0,
    Remarks: t.remarks || "",
  }));
}

async function generateOutstandingPaymentsReport(filters) {
  const query = {
    ...filters.dateFilter,
    "payments.pendingAmount": { $gt: 0 },
  };
  if (filters.branch) query["personal.branch"] = filters.branch;
  if (filters.statusFilter) query["ops.status"] = filters.statusFilter;

  const patients = await Patient.find(query, {
    "personal.name": 1,
    "personal.phone": 1,
    "personal.branch": 1,
    "counselling.counsellor": 1,
    "payments.totalAmount": 1,
    "payments.amountReceived": 1,
    "payments.pendingAmount": 1,
    "surgery.surgeryDate": 1,
    "ops.status": 1,
  })
    .populate("counselling.counsellor", "name")
    .sort({ "payments.pendingAmount": -1 })
    .limit(5000)
    .lean();

  const patientIds = patients.map((p) => p._id);

  const transactions = await Transactions.find({
    patient: { $in: patientIds },
    costType: "Revenue",
  })
    .sort({ patient: 1, date: 1 })
    .lean();

  const txByPatient = {};
  transactions.forEach((t) => {
    const pid = t.patient?.toString();
    if (!txByPatient[pid]) txByPatient[pid] = [];
    txByPatient[pid].push(t);
  });

  const rows = [];
  patients.forEach((p) => {
    const pid = p._id.toString();
    const ptxs = txByPatient[pid] || [];
    const totalAmount = p.payments?.totalAmount || 0;
    const amountReceived = p.payments?.amountReceived || 0;
    const pendingAmount = p.payments?.pendingAmount || 0;
    const paymentPct = totalAmount
      ? ((amountReceived / totalAmount) * 100).toFixed(1) + "%"
      : "0%";
    const daysSinceSurgery = p.surgery?.surgeryDate
      ? Math.floor(
          (new Date() - new Date(p.surgery.surgeryDate)) / (1000 * 60 * 60 * 24)
        )
      : "N/A";

    const base = {
      "Patient Name": p.personal?.name || "",
      Phone: p.personal?.phone || "",
      Branch: p.personal?.branch || "",
      Counsellor: p.counselling?.counsellor?.name || "",
      "Total Amount": totalAmount,
      "Amount Received": amountReceived,
      "Pending Amount": pendingAmount,
      "Payment Percentage": paymentPct,
      Status: p.ops?.status || "",
      "Days Since Surgery": daysSinceSurgery,
    };

    if (ptxs.length === 0) {
      rows.push({
        ...base,
        "Transaction Date": "",
        "Transaction Amount": "",
        "Payment Type": "",
        "Payment Method": "",
      });
    } else {
      ptxs.forEach((t) => {
        rows.push({
          ...base,
          "Transaction Date": t.date
            ? new Date(t.date).toLocaleDateString("en-IN")
            : "",
          "Transaction Amount": t.amount || 0,
          "Payment Type": t.paymentType || "",
          "Payment Method": t.method || "",
        });
      });
    }
  });

  return rows;
}

async function generatePaymentCollectionReport(filters) {
  const query = {
    ...filters.dateFilter,
    costType: "Revenue",
    // "Total Collections" is a total — paid_to_external money isn't collected yet.
    method: { $nin: UNSETTLED_METHODS }, ...SETTLEMENT_EXCLUSION,
  };
  if (filters.branch) query.branch = filters.branch;

  const transactions = await Transactions.find(query)
    .populate("patient", "personal.name counselling.counsellor")
    .populate({
      path: "patient",
      populate: { path: "counselling.counsellor", select: "name" },
    })
    .limit(5000)
    .lean();

  const collectionData = {};

  transactions.forEach((t) => {
    const branch = t.branch || "Unknown";
    const counsellor =
      t.patient?.counselling?.counsellor?.name || "No Counsellor";
    const key = `${branch}_${counsellor}`;

    if (!collectionData[key]) {
      collectionData[key] = {
        Branch: branch,
        Counsellor: counsellor,
        "Total Collections": 0,
        "Number of Transactions": 0,
        "Booking Payments": 0,
        "Pending Payments": 0,
        "Full Payments": 0,
        "Avg Transaction": 0,
      };
    }

    collectionData[key]["Total Collections"] += t.amount || 0;
    collectionData[key]["Number of Transactions"]++;

    if (t.paymentType === "Booking") {
      collectionData[key]["Booking Payments"] += t.amount || 0;
    } else if (t.paymentType === "Pending") {
      collectionData[key]["Pending Payments"] += t.amount || 0;
    } else if (t.paymentType === "Full-payment") {
      collectionData[key]["Full Payments"] += t.amount || 0;
    }
  });

  Object.keys(collectionData).forEach((key) => {
    const data = collectionData[key];
    if (data["Number of Transactions"] > 0) {
      data["Avg Transaction"] = Math.round(
        data["Total Collections"] / data["Number of Transactions"]
      );
    }
  });

  return Object.values(collectionData);
}

async function generateProcedureRevenueReport(filters) {
  const query = {
    ...filters.dateFilter,
    costType: "Revenue",
    method: { $nin: UNSETTLED_METHODS }, ...SETTLEMENT_EXCLUSION,
  };
  if (filters.branch) query.branch = filters.branch;
  if (filters.procedureFilter) query.procedure = filters.procedureFilter;

  const transactions = await Transactions.find(query).limit(5000).lean();

  const procedureData = {};

  transactions.forEach((t) => {
    const procedure = t.procedure || "Other";
    if (!procedureData[procedure]) {
      procedureData[procedure] = {
        Procedure: procedure,
        "Total Revenue": 0,
        "Number of Transactions": 0,
        "Avg Transaction Value": 0,
      };
    }

    procedureData[procedure]["Total Revenue"] += t.amount || 0;
    procedureData[procedure]["Number of Transactions"]++;
  });

  Object.keys(procedureData).forEach((proc) => {
    const data = procedureData[proc];
    if (data["Number of Transactions"] > 0) {
      data["Avg Transaction Value"] = Math.round(
        data["Total Revenue"] / data["Number of Transactions"]
      );
    }
  });

  return Object.values(procedureData);
}

// paid/pending/status are computed live from linked Transactions (buildPayableAggregationStages
// — same aggregation the Liabilities page uses), never stored on the Payable itself. Cancelled
// payables are excluded, matching every other financial report on this page.
async function generatePayablesAllReport(filters) {
  const match = { isCancelled: { $ne: true }, ...filters.dateFilter };
  if (filters.branch) match.branch = filters.branch;

  const txCollection = Transactions.collection.name;
  const rows = await Payable.aggregate([
    { $match: match },
    ...buildPayableAggregationStages(txCollection),
    { $sort: { createdAt: -1 } },
    { $limit: 5000 },
  ]);

  return rows.map((p) => ({
    "Payee": p.payee?.label || "",
    "Payee Type": p.payee?.kind || "",
    Purpose: p.purpose || "",
    "Expense Category": p.expenseCategory || "",
    "Expense Sub-Type": p.expenseSubType || "",
    Period: p.period?.month && p.period?.year ? `${p.period.month}/${p.period.year}` : "",
    Branch: p.branch || "",
    "Total Amount": p.totalAmount || 0,
    Paid: p.paid || 0,
    Pending: p.pending || 0,
    Status: p.status || "",
    "Due Date": p.dueDate ? new Date(p.dueDate).toLocaleDateString() : "",
    // Blank once fully paid — an ageing bucket/day-count on a cleared obligation is stale
    // information carried over from its now-irrelevant due date, the same bug already fixed on
    // the Liabilities page's own ageing display.
    "Ageing Bucket": p.pending > 0 ? p.ageingBucket || "" : "",
    "Days Overdue": p.pending > 0 ? (p.daysOverdue ?? "") : "",
    Remarks: p.remarks || "",
    "Raised On": p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "",
  }));
}

// Mirror of generatePayablesAllReport — see its comment. Uses buildReceivableAggregationStages,
// which keys "received" off linked Revenue transactions instead of Expense ones.
async function generateReceivablesAllReport(filters) {
  const match = { isCancelled: { $ne: true }, ...filters.dateFilter };
  if (filters.branch) match.branch = filters.branch;

  const txCollection = Transactions.collection.name;
  const rows = await Receivable.aggregate([
    { $match: match },
    ...buildReceivableAggregationStages(txCollection),
    { $sort: { createdAt: -1 } },
    { $limit: 5000 },
  ]);

  return rows.map((r) => ({
    Payer: r.payer?.label || "",
    "Payer Type": r.payer?.kind || "",
    Purpose: r.purpose || "",
    "Revenue Category": r.revenueCategory || "",
    Period: r.period?.month && r.period?.year ? `${r.period.month}/${r.period.year}` : "",
    Branch: r.branch || "",
    "Total Amount": r.totalAmount || 0,
    Received: r.received || 0,
    Pending: r.pending || 0,
    Status: r.status || "",
    "Due Date": r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "",
    "Ageing Bucket": r.pending > 0 ? r.ageingBucket || "" : "",
    "Days Overdue": r.pending > 0 ? (r.daysOverdue ?? "") : "",
    Remarks: r.remarks || "",
    "Raised On": r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "",
  }));
}

async function generateBranchComparisonReport(filters) {
  const patientQuery = { ...filters.patientDateFilter };
  const txQuery = { ...filters.transactionDateFilter };

  const branchData = [];

  for (const branch of ALL_BRANCHES) {
    if (!branchAllowed(filters.branch, branch)) continue;

    const branchQuery = { ...patientQuery, "personal.branch": branch };

    const totalPatients = await Patient.countDocuments(branchQuery);
    const surgeries = await Patient.countDocuments({
      ...branchQuery,
      "surgery.surgeryDate": { $exists: true },
    });

    const revenue = await Transactions.aggregate([
      {
        $match: {
          ...txQuery,
          branch: branch,
          costType: "Revenue",
          method: { $nin: UNSETTLED_METHODS }, ...SETTLEMENT_EXCLUSION,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const expenses = await Transactions.aggregate([
      {
        $match: {
          ...txQuery,
          branch: branch,
          costType: "Expenses",
          method: { $nin: UNSETTLED_METHODS }, ...SETTLEMENT_EXCLUSION,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalRevenue = revenue[0]?.total || 0;
    const totalExpenses = expenses[0]?.total || 0;

    branchData.push({
      Branch: branch,
      "Total Patients": totalPatients,
      "Total Surgeries": surgeries,
      "Conversion Rate": totalPatients
        ? ((surgeries / totalPatients) * 100).toFixed(1) + "%"
        : "0%",
      "Total Revenue": totalRevenue,
      "Total Expenses": totalExpenses,
      "Net Profit": totalRevenue - totalExpenses,
      "Profit Margin": totalRevenue
        ? (((totalRevenue - totalExpenses) / totalRevenue) * 100).toFixed(1) +
          "%"
        : "0%",
    });
  }

  return branchData;
}

async function generateBranchRevenueReport(filters) {
  const query = {
    ...filters.dateFilter,
    costType: "Revenue",
    method: { $nin: UNSETTLED_METHODS }, ...SETTLEMENT_EXCLUSION,
  };
  if (filters.branch) query.branch = filters.branch;

  const transactions = await Transactions.find(query).limit(5000).lean();

  const branchData = {};

  transactions.forEach((t) => {
    const branch = t.branch || "Unknown";
    if (!branchData[branch]) {
      branchData[branch] = {
        Branch: branch,
        "Total Revenue": 0,
        "Total Transactions": 0,
        "Hair Transplant Revenue": 0,
        "PRP Revenue": 0,
        "Beard Transplant Revenue": 0,
        "Medicine Revenue": 0,
        "GFC Revenue": 0,
        "Other Revenue": 0,
      };
    }

    branchData[branch]["Total Revenue"] += t.amount || 0;
    branchData[branch]["Total Transactions"]++;

    const procedure = t.procedure || "Other";
    if (procedure === "hair transplant") {
      branchData[branch]["Hair Transplant Revenue"] += t.amount || 0;
    } else if (procedure === "prp") {
      branchData[branch]["PRP Revenue"] += t.amount || 0;
    } else if (procedure === "beard transplant") {
      branchData[branch]["Beard Transplant Revenue"] += t.amount || 0;
    } else if (procedure === "medicine") {
      branchData[branch]["Medicine Revenue"] += t.amount || 0;
    } else if (procedure === "gfc") {
      branchData[branch]["GFC Revenue"] += t.amount || 0;
    } else {
      branchData[branch]["Other Revenue"] += t.amount || 0;
    }
  });

  return Object.values(branchData);
}

async function generateBranchPatientsReport(filters) {
  const query = { ...filters.dateFilter };

  const branchData = [];

  for (const branch of ALL_BRANCHES) {
    if (!branchAllowed(filters.branch, branch)) continue;

    const branchQuery = { ...query, "personal.branch": branch };

    const totalPatients = await Patient.countDocuments(branchQuery);
    const newPatients = await Patient.countDocuments({
      ...branchQuery,
      "ops.status": "NEW",
    });
    const consulted = await Patient.countDocuments({
      ...branchQuery,
      "ops.status": "CONSULTED",
    });
    const scheduled = await Patient.countDocuments({
      ...branchQuery,
      "ops.status": "SURGERY_BOOKED",
    });
    const bookingDone = await Patient.countDocuments({
      ...branchQuery,
      "ops.status": "BOOKING_DONE",
    });
    const closed = await Patient.countDocuments({
      ...branchQuery,
      "ops.status": "CLOSED",
    });

    branchData.push({
      Branch: branch,
      "Total Patients": totalPatients,
      "New Patients": newPatients,
      Consulted: consulted,
      "Surgery Booked": scheduled,
      "Booking Done": bookingDone,
      Closed: closed,
      "Conversion Rate":
        totalPatients > 0
          ? (((bookingDone + closed) / totalPatients) * 100).toFixed(1) + "%"
          : "0%",
    });
  }

  return branchData;
}

// Independent fetch, deliberately not reusing the route's shared `allEmployees` — that one is
// pre-filtered to isactive:true and pre-projected to 4 fields for the OTHER staff reports
// (Counsellor/Agent/Doctor/etc. performance, which only need name/role/email/phone). "All
// Employees Report" means all of them — active AND inactive, every real field on the document.
//
// Two real bugs this replaces:
//   - e.branch / e.isactive were read from a query that never selected either field, so every
//     row showed a blank Branch and "Inactive" (even for active staff) regardless of reality —
//     and since e.branch was always undefined, the branch filter's `!e.branch || ...` was
//     always true, silently showing every branch no matter what was selected.
//   - "Patient Count" was a Patient aggregation keyed on counselling.counsellor ONLY, so every
//     non-Counsellor role (Doctor/Technician/Implanter/Agent/HR) always showed 0 regardless of
//     how many patients they actually handled.
// Employee.branch now exists (see src/models/Employee.js, added + backfilled in Step 6) — but
// this report still deliberately doesn't filter or select it: "All Employees Report" means
// every employee across every branch, so a branch scope has no reason to apply here.
async function generateEmployeesAllReport() {
  const employees = await Employee.find({})
    .select("name role email phone isactive salaryStructure incentiveRate patient createdAt updatedAt")
    .sort({ name: 1 })
    .lean();

  return employees.map((e) => ({
    "Employee ID": e._id.toString(),
    Name: e.name || "",
    Role: e.role || "",
    Email: e.email || "",
    Phone: e.phone || "",
    Status: e.isactive ? "Active" : "Inactive",
    // Employee.patient[] is kept in sync by the patient create/update/delete routes — the same
    // field src/app/api/employees/get-patients/route.js already treats as authoritative,
    // covering every role (not just counsellors).
    "Total Patients": Array.isArray(e.patient) ? e.patient.length : 0,
    "Base Salary": e.salaryStructure?.baseSalary ?? "",
    "Salary Type": e.salaryStructure?.salaryType || "",
    "Salary Effective From": e.salaryStructure?.effectiveFrom
      ? new Date(e.salaryStructure.effectiveFrom).toLocaleDateString()
      : "",
    "Incentive Rate": e.incentiveRate ?? "",
    "Joined On": e.createdAt ? new Date(e.createdAt).toLocaleDateString() : "",
    "Last Updated": e.updatedAt ? new Date(e.updatedAt).toLocaleDateString() : "",
  }));
}

async function generateStocksAllReport() {
  const stocks = await Stock.find({}).limit(5000).lean();

  return stocks.map((s) => ({
    "Stock Name": s.name || "",
    Location: s.location || "",
    "Total Quantity": s.totalQuantity ?? 0,
    Unit: s.unit || "",
    MRP: s.mrp ?? "",
    "Purchase Amount": s.purchaseAmt ?? "",
    "Sold Amount": s.soldAmt ?? "",
    "Stock Value": ((s.totalQuantity || 0) * (s.purchaseAmt || 0)).toFixed(2),
    "Expiry Date": s.expiry ? new Date(s.expiry).toLocaleDateString() : "",
    "GST No": s.gstNo || "",
    "Added By": s.createdBy?.name || "",
    "Added Branch": s.createdBy?.branch || "",
  }));
}

async function generateVendorsAllReport() {
  const vendors = await Vendor.find({}).limit(5000).lean();

  return vendors.map((v) => ({
    "Vendor Name": v.name || "",
    Phone: v.contact ? String(v.contact) : "",
    Email: v.email || "",
    Address: v.address || "",
    "GST Number": v.gstNumber || "",
    "Deals In": v.DealsIn || "",
    "Transaction Count": Array.isArray(v.Transactions) ? v.Transactions.length : 0,
  }));
}
