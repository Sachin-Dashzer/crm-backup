import { encode } from "next-auth/jwt";

const secret = process.env.NEXTAUTH_SECRET;

async function runVerification() {
  console.log("=================================================");
  console.log("LIVE BACKEND SECURITY VERIFICATION ON PORT 3001");
  console.log("=================================================\n");

  // 1. Create a valid NextAuth session token for Sales user
  const salesToken = await encode({
    token: {
      id: "6909e8178afdaeb73d366c35",
      name: "Ryan Sales",
      email: "ryansales@gmail.com",
      role: "sales",
      branch: "All",
      sessionVersion: 0,
      lastValidated: Date.now() + 1000 * 60 * 60, // valid for 1 hour
    },
    secret: secret,
  });

  const salesCookie = `next-auth.session-token=${salesToken}`;

  const tests = [
    // --- Unauthenticated Checks ---
    {
      group: "UNAUTHENTICATED (Expected 401)",
      name: "Unauthenticated → POST /api/sales/dashboard",
      url: "http://localhost:3001/api/sales/dashboard",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      expectedStatus: 401,
    },
    {
      group: "UNAUTHENTICATED (Expected 401)",
      name: "Unauthenticated → GET /api/sales/agents",
      url: "http://localhost:3001/api/sales/agents",
      method: "GET",
      headers: {},
      expectedStatus: 401,
    },
    {
      group: "UNAUTHENTICATED (Expected 401)",
      name: "Unauthenticated → GET /api/sales/performance",
      url: "http://localhost:3001/api/sales/performance",
      method: "GET",
      headers: {},
      expectedStatus: 401,
    },

    // --- Sales CRUD Security Checks (Expected 403) ---
    {
      group: "SALES MUTATION REJECTIONS (Expected 403)",
      name: "Sales → POST /api/patients/create",
      url: "http://localhost:3001/api/patients/create",
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie },
      body: JSON.stringify({ personal: { name: "Test Patient", phone: "9999999999" } }),
      expectedStatus: 403,
    },
    {
      group: "SALES MUTATION REJECTIONS (Expected 403)",
      name: "Sales → PUT /api/patients/update",
      url: "http://localhost:3001/api/patients/update?id=6909e7b98afdaeb73d366c32",
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: salesCookie },
      body: JSON.stringify({ personal: { name: "Hacked" } }),
      expectedStatus: 403,
    },
    {
      group: "SALES MUTATION REJECTIONS (Expected 403)",
      name: "Sales → POST /api/transactions/transplant/create",
      url: "http://localhost:3001/api/transactions/transplant/create",
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie },
      body: JSON.stringify({ amount: 1000 }),
      expectedStatus: 403,
    },
    {
      group: "SALES MUTATION REJECTIONS (Expected 403)",
      name: "Sales → PUT /api/transactions/transplant/update",
      url: "http://localhost:3001/api/transactions/transplant/update",
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: salesCookie },
      body: JSON.stringify({ id: "6909e7b98afdaeb73d366c32", amount: 500 }),
      expectedStatus: 403,
    },
    {
      group: "SALES MUTATION REJECTIONS (Expected 403)",
      name: "Sales → DELETE /api/transactions/transplant/delete",
      url: "http://localhost:3001/api/transactions/transplant/delete",
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: salesCookie },
      body: JSON.stringify({ transactionId: "6909e7b98afdaeb73d366c32" }),
      expectedStatus: 403,
    },
    {
      group: "SALES MUTATION REJECTIONS (Expected 403)",
      name: "Sales → POST /api/employees/create",
      url: "http://localhost:3001/api/employees/create",
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie },
      body: JSON.stringify({ name: "Fake Emp", phone: "9999999999", role: "Agent" }),
      expectedStatus: 403,
    },
    {
      group: "SALES MUTATION REJECTIONS (Expected 403)",
      name: "Sales → PUT /api/employees/update/[id]",
      url: "http://localhost:3001/api/employees/update/6909e7b98afdaeb73d366c32",
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: salesCookie },
      body: JSON.stringify({ name: "Updated Name", role: "Agent" }),
      expectedStatus: 403,
    },
    {
      group: "SALES MUTATION REJECTIONS (Expected 403)",
      name: "Sales → POST /api/transactions/6909e7b98afdaeb73d366c32/reverse",
      url: "http://localhost:3001/api/transactions/6909e7b98afdaeb73d366c32/reverse",
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie },
      body: JSON.stringify({ reason: "test", amount: 100 }),
      expectedStatus: 403,
    },
    {
      group: "SALES MUTATION REJECTIONS (Expected 403)",
      name: "Sales → POST /api/transactions/6909e7b98afdaeb73d366c32/cancel-loan",
      url: "http://localhost:3001/api/transactions/6909e7b98afdaeb73d366c32/cancel-loan",
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie },
      body: JSON.stringify({ reason: "test" }),
      expectedStatus: 403,
    },
    {
      group: "SALES MUTATION REJECTIONS (Expected 403)",
      name: "Sales → POST /api/patients/6909e7b98afdaeb73d366c32/incentives",
      url: "http://localhost:3001/api/patients/6909e7b98afdaeb73d366c32/incentives",
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie },
      body: JSON.stringify({ amount: 100 }),
      expectedStatus: 403,
    },
  ];

  let currentGroup = "";
  let passedCount = 0;
  let failedCount = 0;

  for (const t of tests) {
    if (t.group !== currentGroup) {
      currentGroup = t.group;
      console.log(`\n--- ${currentGroup} ---`);
    }

    try {
      const res = await fetch(t.url, {
        method: t.method,
        headers: t.headers,
        body: t.body,
        redirect: "manual",
      });

      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch (_) {
        body = text.slice(0, 120);
      }

      const passed = res.status === t.expectedStatus;
      if (passed) {
        passedCount++;
        console.log(`[PASS] ${t.name} -> HTTP ${res.status}`);
        console.log(`       Response: ${JSON.stringify(body)}`);
      } else {
        failedCount++;
        console.log(`[FAIL] ${t.name} -> Expected HTTP ${t.expectedStatus}, Got ${res.status}`);
        console.log(`       Response: ${JSON.stringify(body)}`);
      }
    } catch (err) {
      failedCount++;
      console.log(`[ERROR] ${t.name} -> ${err.message}`);
    }
  }

  console.log("\n=================================================");
  console.log(`VERIFICATION SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=================================================");
}

runVerification();
