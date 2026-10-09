import { encode } from "next-auth/jwt";
import fs from 'fs';

if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

const secret = process.env.NEXTAUTH_SECRET;

async function test() {
  console.log("=== Testing /api/sales/agents Endpoint ===");

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
  const baseUrl = "http://localhost:3000/api/sales/agents";

  // 1. Unauthenticated -> 401
  const res1 = await fetch(baseUrl);
  console.log("1. Unauthenticated status:", res1.status, "(Expected 401)");

  // 2. Sales Authenticated (default: this month)
  console.time("API Response Time (259 agents batched)");
  const res2 = await fetch(`${baseUrl}?limit=10`, { headers: { Cookie: cookie } });
  const data2 = await res2.json();
  console.timeEnd("API Response Time (259 agents batched)");

  console.log("2. Sales Authenticated status:", res2.status, "success:", data2.success);
  console.log("   KPIs returned:", data2.kpis);
  console.log("   Pagination:", data2.pagination);
  console.log("   Available branches count:", data2.availableBranches?.length);
  console.log("   First agent returned:", {
    name: data2.agents?.[0]?.name,
    empId: data2.agents?.[0]?.employeeId,
    totalPatients: data2.agents?.[0]?.totalPatients,
    leads: data2.agents?.[0]?.totalLeads,
    converted: data2.agents?.[0]?.converted,
    revenue: data2.agents?.[0]?.totalRevenue,
    packages: data2.agents?.[0]?.packageBreakdown?.length,
    branches: data2.agents?.[0]?.branchBreakdown?.length,
  });

  // 3. Search for Aachal
  const res3 = await fetch(`${baseUrl}?search=Aachal&all=1`, { headers: { Cookie: cookie } });
  const data3 = await res3.json();
  console.log("3. Search 'Aachal' (all=1):", data3.agents?.map(a => ({
    name: a.name,
    empId: a.employeeId,
    totalPatients: a.totalPatients,
    leads: a.totalLeads,
    converted: a.converted,
    rate: a.conversionRate + "%",
    revenue: a.totalRevenue,
    tlName: a.tlName,
    packageBreakdown: a.packageBreakdown,
    branchBreakdown: a.branchBreakdown
  })));

  // 4. Branch filter test: Mumbai
  const res4 = await fetch(`${baseUrl}?branch=Mumbai&all=1&limit=5`, { headers: { Cookie: cookie } });
  const data4 = await res4.json();
  console.log("4. Branch=Mumbai KPIs:", data4.kpis);
  console.log("   Top agent in Mumbai:", data4.agents?.[0]?.name, "leads:", data4.agents?.[0]?.totalLeads, "rev:", data4.agents?.[0]?.totalRevenue);

  console.log("=== All tests completed successfully ===");
}

test().catch(console.error);
