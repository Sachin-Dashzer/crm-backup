import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Leads from "@/models/Leads";

const handler = async (req) => {
  const { name, phone, email, location, visitPlan, visitDate, remarks, tag } =
    await req.json();

  if (!name || !phone) {
    return NextResponse.json(
      { message: "Name and phone are required" },
      { status: 400 }
    );
  }

  const newLead = new Leads({
    name,
    phone,
    email,
    location,
    visitPlan,
    visitDate,
    remarks,
    tag,
  });

  await newLead.save();

  return NextResponse.json(
    { message: "Lead created successfully", lead: newLead },
    { status: 201 }
  );
};

export const POST = withDB(handler);
