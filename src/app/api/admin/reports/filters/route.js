import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { withDB } from "@/lib/withDB";
import Transactions from "@/models/Transactions";
import Employee from "@/models/Employee";

const handler = async (req) => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const [staff, techniques, status] = await Promise.all([
      Employee.find({}, { name: 1, role: 1 }).lean(),
      Transactions.distinct("procedure"),
      Transactions.distinct("status"),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: {
          staff: staff.map((s) => ({ _id: s._id, name: s.name, role: s.role })),
          techniques: techniques.filter(Boolean),
          status: status.filter(Boolean),
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      },
    );
  } catch (error) {
    console.error("Reports filter-options error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch filter options",
        error: error.message,
      },
      { status: 500 },
    );
  }
};

export const GET = withDB(handler);
