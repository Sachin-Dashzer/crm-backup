import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Employee from "@/models/Employee";

const handler = async (req) => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const [counsellors, agents, t1, t2, t3] = await Promise.all([
      Employee.distinct("name", { role: "Counsellor", isactive: true }),
      Employee.distinct("name", { role: "Agent", isactive: true }),
      Patient.distinct("counselling.techniqueSuggested"),
      Patient.distinct("surgery.technique"),
      Patient.distinct("personal.techniqueQuoted"),
    ]);

    return NextResponse.json({
      success: true,
      counsellors: counsellors.filter(Boolean).sort(),
      agents: agents.filter(Boolean).sort(),
      techniques: [...new Set([...t1, ...t2, ...t3].filter(Boolean))].sort(),
    });
  } catch (error) {
    console.error("Error fetching filter options:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch filter options" }, { status: 500 });
  }
};

export const GET = withDB(handler);
