import dbConnect from "@/lib/db";
import Patient from "@/models/Patient";
import Employee from "@/models/Employee";
import Transactions from "@/models/Transactions";

export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const branch = searchParams.get("branch");
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

    // Build date filter
    const dateFilter = {};
    if (from && to) {
      dateFilter.createdAt = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }

    switch (type) {
      // ==================== PATIENT REPORTS ====================
      case "patients-comprehensive":
        data = await generateComprehensivePatientReport({
          dateFilter,
          branch,
          staffFilter,
          techniqueFilter,
          statusFilter,
        });
        break;

      case "patients-demographics":
        data = await generateDemographicsReport({ dateFilter, branch });
        break;

      case "patients-status":
        data = await generateStatusReport({ dateFilter, branch, statusFilter });
        break;

      case "patients-medical":
        data = await generateMedicalHistoryReport({ dateFilter, branch });
        break;

      // ==================== STAFF REPORTS ====================
      case "counsellors":
        data = await generateCounsellorReport({
          dateFilter,
          branch,
          staffFilter,
          employees: employeesByRole.counsellors,
        });
        break;

      case "agents":
        data = await generateAgentReport({ dateFilter, branch, staffFilter, employees: employeesByRole.agents });
        break;

      case "doctors":
        data = await generateDoctorReport({
          dateFilter,
          branch,
          staffFilter,
          techniqueFilter,
          employees: employeesByRole.doctors,
        });
        break;

      case "implanters":
        data = await generateImplanterReport({
          dateFilter,
          branch,
          staffFilter,
          employees: employeesByRole.implanters,
        });
        break;

      case "technicians":
        data = await generateTechnicianReport({
          dateFilter,
          branch,
          staffFilter,
          employees: employeesByRole.technicians,
        });
        break;

      // ==================== MEDICAL REPORTS ====================
      case "techniques":
        data = await generateTechniqueReport({
          dateFilter,
          branch,
          techniqueFilter,
        });
        break;

      case "surgery-schedule":
        data = await generateSurgeryScheduleReport({
          dateFilter,
          branch,
          staffFilter,
        });
        break;

      case "grafts-analysis":
        data = await generateGraftsAnalysisReport({
          dateFilter,
          branch,
          techniqueFilter,
        });
        break;

      case "counselling-outcomes":
        data = await generateCounsellingOutcomesReport({
          dateFilter,
          branch,
          staffFilter,
        });
        break;

      // ==================== FINANCIAL REPORTS ====================
      case "revenue":
        data = await generateRevenueReport({
          dateFilter,
          branch,
          procedureFilter,
          paymentTypeFilter,
        });
        break;

      case "expenses":
        data = await generateExpensesReport({ dateFilter, branch });
        break;

      case "transactions":
        data = await generateTransactionsReport({
          dateFilter,
          branch,
          procedureFilter,
          paymentTypeFilter,
        });
        break;

      case "outstanding-payments":
        data = await generateOutstandingPaymentsReport({
          dateFilter,
          branch,
          statusFilter,
        });
        break;

      case "payment-collection":
        data = await generatePaymentCollectionReport({
          dateFilter,
          branch,
          staffFilter,
        });
        break;

      case "procedure-revenue":
        data = await generateProcedureRevenueReport({
          dateFilter,
          branch,
          procedureFilter,
        });
        break;

      // ==================== BRANCH REPORTS ====================
      case "branch-comparison":
        data = await generateBranchComparisonReport({ dateFilter });
        break;

      case "branch-revenue":
        data = await generateBranchRevenueReport({ dateFilter, branch });
        break;

      case "branch-patients":
        data = await generateBranchPatientsReport({ dateFilter, branch });
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
    "Expense Type": t.expense || "",
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
    "Expense Type": t.expense || "N/A",
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

async function generateBranchComparisonReport(filters) {
  const branches = ["Delhi", "Mumbai", "Hyderabad"];
  const query = { ...filters.dateFilter };

  const branchData = [];

  for (const branch of branches) {
    const branchQuery = { ...query, "personal.branch": branch };

    const totalPatients = await Patient.countDocuments(branchQuery);
    const surgeries = await Patient.countDocuments({
      ...branchQuery,
      "surgery.surgeryDate": { $exists: true },
    });

    const revenue = await Transactions.aggregate([
      {
        $match: {
          ...filters.dateFilter,
          branch: branch,
          costType: "Revenue",
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
          ...filters.dateFilter,
          branch: branch,
          costType: "Expenses",
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
  const branches = ["Delhi", "Mumbai", "Hyderabad"];
  const query = { ...filters.dateFilter };

  const branchData = [];

  for (const branch of branches) {
    if (filters.branch && filters.branch !== branch) continue;

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
