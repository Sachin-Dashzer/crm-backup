import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Patient from "@/models/Patient";
import Employee from "@/models/Employee";
import Payable from "@/models/Payable";
import { INCENTIVE_PURPOSES } from "@/constants/incentivePurposes";
import { findOrCreateIncentivePayable, recomputeIncentivePayable, IncentiveError } from "@/lib/incentiveDerivation";

const ALLOWED_ROLES = ["admin", "super-admin"];

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid patient ID" }, { status: 400 });
    }

    const { employee, purpose, amount, date, branch, remarks } = await req.json();

    if (!employee || !mongoose.Types.ObjectId.isValid(employee)) {
      return NextResponse.json({ error: "Select an employee" }, { status: 400 });
    }
    if (!purpose || !INCENTIVE_PURPOSES.includes(purpose)) {
      return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
    }
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    }

    const employeeDoc = await Employee.findById(employee).select("name role").lean();
    if (!employeeDoc) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const when = date ? new Date(date) : new Date();
    const period = { month: when.getMonth() + 1, year: when.getFullYear() };
    const performedBy = { name: session.user.name, email: session.user.email };
    const actor = { name: session.user.name, email: session.user.email, branch: session.user.branch };

    let createdRow = null;
    let payableAfter = null;

    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const patient = await Patient.findById(id).session(dbSession);
        if (!patient) {
          throw new IncentiveError(404, { error: "Patient not found" });
        }

        const resolvedBranch = branch || patient.personal?.branch || undefined;

        const payable = await findOrCreateIncentivePayable({
          session: dbSession,
          employeeId: employeeDoc._id,
          employeeLabel: employeeDoc.name,
          branch: resolvedBranch,
          period,
          relatedPatient: patient._id,
          date: when,
          actor,
        });

        patient.incentives.push({
          employee: employeeDoc._id,
          employeeName: employeeDoc.name,
          role: employeeDoc.role,
          purpose,
          amount: parsedAmount,
          date: when,
          branch: resolvedBranch,
          payableId: payable._id,
          remarks: remarks || "",
          createdBy: { ...actor, date: new Date() },
          log: [
            {
              action: "Created",
              newValue: String(parsedAmount),
              note: remarks || undefined,
              performedBy,
              performedAt: new Date(),
            },
          ],
        });
        await patient.save({ session: dbSession });

        await recomputeIncentivePayable({ session: dbSession, payableId: payable._id, actor });

        createdRow = patient.incentives[patient.incentives.length - 1];
        payableAfter = await Payable.findById(payable._id).session(dbSession);
      });
    } catch (err) {
      if (err instanceof IncentiveError) {
        return NextResponse.json(err.body, { status: err.status });
      }
      throw err;
    } finally {
      await dbSession.endSession();
    }

    return NextResponse.json(
      {
        message: "Incentive recorded",
        incentive: createdRow,
        payable: payableAfter,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error recording incentive:", error);
    return NextResponse.json({ error: error.message || "Failed to record incentive" }, { status: 500 });
  }
}
