import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Transaction from "@/models/Transactions";
import Patient from "@/models/Patient";

const handler = async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get("id");

    if (!transactionId) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 },
      );
    }

    let data = await Patient.findById(transactionId).populate({
      path: "patient",
      select: "personal payments counselling.counsellor",
    });

    if (data) {
    } else {
      data = await Transaction.findById(transactionId);
    }

    if (!data) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
};

export const GET = withDB(handler);
