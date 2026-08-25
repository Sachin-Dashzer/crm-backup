import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Employee from "@/models/Employee";
import { byName } from "@/lib/sortOptions";

const handler = async (req) => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const [counsellors, agents, doctors, seniorTechs, implanters, t1, t2, t3, surgeryLocations] =
      await Promise.all([
        Employee.distinct("name", { role: "Counsellor", isactive: true }),
        Employee.distinct("name", { role: "Agent",      isactive: true }),
        Employee.distinct("name", { role: "Doctor",     isactive: true }),
        Employee.distinct("name", { role: "Technician", isactive: true }),
        Employee.distinct("name", { role: "Implanter",  isactive: true }),
        Patient.distinct("counselling.techniqueSuggested"),
        Patient.distinct("surgery.technique"),
        Patient.distinct("personal.techniqueQuoted"),
        // Moved here from /api/patients/get-patient, which ran this distinct — a full collection
        // scan — on EVERY list request, i.e. on every page change, sort and filter tweak, purely
        // to populate a dropdown. This route is called once per mount, which is where it belongs.
        Patient.distinct("surgery.location"),
      ]);

    return NextResponse.json(
      {
        success: true,
        counsellors: counsellors.filter(Boolean).sort(byName),
        agents:      agents.filter(Boolean).sort(byName),
        doctors:     doctors.filter(Boolean).sort(byName),
        seniorTechs: seniorTechs.filter(Boolean).sort(byName),
        implanters:  implanters.filter(Boolean).sort(byName),
        techniques:  [...new Set([...t1, ...t2, ...t3].filter(Boolean))].sort(byName),
        surgeryLocations: surgeryLocations.filter(Boolean).sort(byName),
      },
      {
        headers: {
          // Dropdown contents change on the order of days, not seconds. `private` because the
          // response is behind a session check and must never land in a shared/CDN cache.
          "Cache-Control": "private, max-age=300",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching filter options:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch filter options" }, { status: 500 });
  }
};

export const GET = withDB(handler);
