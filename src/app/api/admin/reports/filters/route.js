import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { withDB } from "@/lib/withDB";
import Transactions from "@/models/Transactions";
import Employee from "@/models/Employee";

/**
 * Dropdown options for the reports pages' Staff / Technique / Status selects.
 *
 * This started life as a debug scratchpad and was wired into a production page load. It used to
 * additionally compute: a `statistics` block (total/revenue/expense counts, a countDocuments PER
 * DISTINCT BRANCH — an N+1 — and two `$exists`/`null` counts that no index can serve), and a
 * `samples` block (10 recent transactions plus one sample of each cost type). Roughly eleven
 * queries per call.
 *
 * Its only two callers — src/app/reception/reports/page.js:277 and
 * src/app/collab/reports/page.js:278 — read `data.staff`, `data.techniques` and `data.status` and
 * nothing else, so all of that was computed and discarded on every reports page load. If you need
 * those figures again, put them behind an explicit `?debug=1` rather than the default path.
 */
const handler = async (req) => {
  try {
    // Previously unauthenticated, which exposed the full staff list to anyone who called it.
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // `techniques` and the old `procedures` were the same distinct("procedure") call, issued twice.
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
          // Dropdown contents change on the order of days. `private` because this sits behind a
          // session check and must never land in a shared/CDN cache.
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
