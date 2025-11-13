import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Transactions from "@/models/Transactions";

const handler = async (req) => {
  try {
    const activePatientsCount = await Patient.countDocuments({
      "ops.status": { $ne: "CLOSED" },
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const monthlyRevenue = await Transactions.aggregate([
      {
        $match: {
          costType: "Revenue",
          procedure: { $ne: "medicine" },
          date: { $gte: startOfMonth, $lt: startOfNextMonth },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalRevenue = monthlyRevenue[0]?.total || 0;

    const finalvalue = `${(totalRevenue / 100000).toFixed(1)}L`;




    return NextResponse.json(
      {
        success: true,
        activePatients: activePatientsCount,
        finalvalue,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching active patient count:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch patient statistics",
      },
      { status: 500 }
    );
  }
};

export const GET = withDB(handler);
