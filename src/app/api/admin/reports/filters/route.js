import dbConnect from "@/lib/db";
import Employee from "@/models/Employee";
import Patient from "@/models/Patient";

export async function GET(request) {
  try {
    await dbConnect();

    // Get all unique staff names
    const staff = await Employee.find({}, "name").lean();
    const staffNames = staff.map((s) => s.name).sort();

    // Get unique techniques from patients
    const techniquesFromCounselling = await Patient.distinct(
      "counselling.techniqueSuggested"
    );
    const techniquesFromSurgery = await Patient.distinct("surgery.technique");
    const techniques = [
      ...new Set([...techniquesFromCounselling, ...techniquesFromSurgery]),
    ]
      .filter(Boolean)
      .sort();

    // Get unique statuses
    const status = await Patient.distinct("ops.status");
    const sortedStatus = status.filter(Boolean).sort();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          staff: staffNames,
          techniques: techniques,
          status: sortedStatus,
        },
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error("Error fetching filter options:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}