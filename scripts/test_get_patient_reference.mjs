import { encode } from "next-auth/jwt";
import fs from 'fs';

if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

const secret = process.env.NEXTAUTH_SECRET;

async function test() {
  console.log("=== Testing /api/patients/get-patient Reference Filter ===");

  const salesToken = await encode({
    token: {
      id: "6909e8178afdaeb73d366c35",
      name: "Ryan Sales",
      email: "ryansales@gmail.com",
      role: "sales",
      branch: "All",
      sessionVersion: 0,
      lastValidated: Date.now() + 1000 * 60 * 60,
    },
    secret: secret,
  });

  const cookie = `next-auth.session-token=${salesToken}`;
  const baseUrl = "http://localhost:3000/api/patients/get-patient";

  // 1. Unauthenticated -> 401
  const res1 = await fetch(`${baseUrl}?reference=691e9d24164751f6ae6a30b6`);
  console.log("1. Unauthenticated status:", res1.status, "(Expected 401)");

  // 2. Sales Authenticated -> 200
  const res2 = await fetch(`${baseUrl}?all=1`, { headers: { Cookie: cookie } });
  console.log("2. Sales Authenticated without reference status:", res2.status, "(Expected 200)");

  // 3. Valid reference (Aachal: 691e9d24164751f6ae6a30b6) -> matching patients
  const res3 = await fetch(`${baseUrl}?reference=691e9d24164751f6ae6a30b6&all=1`, { headers: { Cookie: cookie } });
  const data3 = await res3.json();
  console.log("3. Valid reference status:", res3.status, "total patients:", data3.total, "(Expected 49)");
  const allMatch = data3.patients?.every(p => p.personal?.reference?._id === "691e9d24164751f6ae6a30b6" || p.personal?.reference === "691e9d24164751f6ae6a30b6");
  console.log("   All patients match Aachal reference?", allMatch);

  // 4. Invalid ObjectId -> 400
  const res4 = await fetch(`${baseUrl}?reference=not-a-valid-id`, { headers: { Cookie: cookie } });
  const data4 = await res4.json();
  console.log("4. Invalid ObjectId status:", res4.status, "(Expected 400), error:", data4.error);

  // 5. Nonexistent ObjectId -> 200 with empty array
  const res5 = await fetch(`${baseUrl}?reference=000000000000000000000000&all=1`, { headers: { Cookie: cookie } });
  const data5 = await res5.json();
  console.log("5. Nonexistent ObjectId status:", res5.status, "(Expected 200), total:", data5.total, "(Expected 0)");

  // 6. No reference -> existing behavior intact
  const res6 = await fetch(`${baseUrl}?limit=5`, { headers: { Cookie: cookie } });
  const data6 = await res6.json();
  console.log("6. Standard call without reference status:", res6.status, "patients returned:", data6.patients?.length);

  console.log("=== All 6 tests completed ===");
}

test().catch(console.error);
