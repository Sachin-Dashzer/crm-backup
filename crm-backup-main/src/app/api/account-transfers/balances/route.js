import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import { ACCOUNTS } from "@/constants/bankRouting";
import { getAccountBalance } from "@/lib/accountBalances";

const ALLOWED_ROLES = ["admin", "super-admin"];

// Live balances for every account as of a date. Backs the contra form's "show both
// accounts' current balances as the user picks them" (§5.5) — seeing the source balance
// before saving is what makes a wrong-direction entry obvious while it can still be fixed.
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const asOf = searchParams.get("asOf") || new Date().toISOString();

    const entries = await Promise.all(
      ACCOUNTS.map(async (account) => [account, await getAccountBalance(account, asOf)]),
    );

    return NextResponse.json({
      success: true,
      asOf,
      balances: Object.fromEntries(entries),
    });
  } catch (error) {
    console.error("Error computing account balances:", error);
    return NextResponse.json({ error: "Failed to compute balances" }, { status: 500 });
  }
}
