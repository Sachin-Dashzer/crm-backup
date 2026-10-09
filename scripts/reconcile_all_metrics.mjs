import mongoose from 'mongoose';
import { encode } from 'next-auth/jwt';
import fs from 'fs';
import { UNSETTLED_METHODS, SETTLEMENT_EXCLUSION } from '../src/constants/bankRouting.js';

if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

const secret = process.env.NEXTAUTH_SECRET;

async function runOverallReconciliation() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log("==================================================================");
  console.log("SYSTEM-WIDE RECONCILIATION AUDIT (ALL TIME)");
  console.log("==================================================================\n");

  const CONVERTED_STATUSES = ['SURGERY_BOOKED', 'BOOKING_DONE', 'CLOSED'];

  // 1. Fetch all Agent IDs
  const agentDocs = await db.collection('employees').find({ role: 'Agent' }).toArray();
  const agentIds = agentDocs.map(a => a._id);
  const agentIdSet = new Set(agentIds.map(id => String(id)));
  const totalAgentsCount = agentDocs.length;
  const activeAgentsCount = agentDocs.filter(a => a.isactive !== false).length;

  console.log(`1. Total Agents in DB:  ${totalAgentsCount}`);
  console.log(`   Active Agents in DB: ${activeAgentsCount}`);

  // 2. Direct DB Query for all patient records referenced to these agents
  const referencedPatients = await db.collection('patients').find({
    'personal.reference': { $in: agentIds }
  }, {
    projection: {
      '_id': 1,
      'personal.reference': 1,
      'personal.branch': 1,
      'ops.status': 1,
      'counselling.techniqueSuggested': 1,
      'surgery.technique': 1,
      'personal.techniqueQuoted': 1,
      'personal.packageQuoted': 1,
    }
  }).toArray();

  const directTotalLeads = referencedPatients.length;
  const directConverted = referencedPatients.filter(p => CONVERTED_STATUSES.includes(p.ops?.status)).length;
  const directRate = directTotalLeads > 0 ? parseFloat(((directConverted / directTotalLeads) * 100).toFixed(1)) : 0;

  console.log(`\n2. Direct Patients Metrics (All Time, Referenced to Agents):`);
  console.log(`   Total Leads:     ${directTotalLeads}`);
  console.log(`   Converted Leads: ${directConverted}`);
  console.log(`   Conversion Rate: ${directRate}%`);

  // 3. Direct DB Settled Revenue via fast aggregation matching API
  const patientAgentMap = new Map();
  referencedPatients.forEach(p => {
    patientAgentMap.set(String(p._id), String(p.personal.reference));
  });

  const txAgg = await db.collection('transactions').aggregate([
    {
      $match: {
        costType: 'Revenue',
        method: { $nin: UNSETTLED_METHODS },
        ...SETTLEMENT_EXCLUSION,
        patient: { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: '$patient',
        amount: { $sum: '$amount' }
      }
    }
  ]).toArray();

  let directTotalRevenue = 0;
  txAgg.forEach(t => {
    const aId = patientAgentMap.get(String(t._id));
    if (aId && agentIdSet.has(aId)) {
      directTotalRevenue += (t.amount || 0);
    }
  });

  console.log(`   Settled Revenue: ₹${directTotalRevenue.toLocaleString('en-IN')}`);

  // 4. API Request for All Agents (All Time)
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

  const apiRes = await fetch("http://localhost:3000/api/sales/agents?all=1", {
    headers: { Cookie: cookie }
  });
  const apiData = await apiRes.json();

  console.log(`\n3. API Overview Summary:`);
  console.log(`   API Total Agents:  ${apiData.kpis?.totalAgents}`);
  console.log(`   API Active Agents: ${apiData.kpis?.activeAgents}`);
  console.log(`   API Total Leads:   ${apiData.kpis?.totalLeads}`);
  console.log(`   API Converted:     ${apiData.kpis?.totalConverted}`);
  console.log(`   API Rate:          ${apiData.kpis?.avgConversion}%`);
  console.log(`   API Revenue:       ₹${apiData.kpis?.totalRevenue?.toLocaleString('en-IN')}`);

  // 5. Verification Assertions
  const agentsMatch = totalAgentsCount === apiData.kpis?.totalAgents;
  const activeMatch = activeAgentsCount === apiData.kpis?.activeAgents;
  const leadsMatch = directTotalLeads === apiData.kpis?.totalLeads;
  const convMatch = directConverted === apiData.kpis?.totalConverted;
  const rateMatch = directRate === apiData.kpis?.avgConversion;
  const revMatch = Math.round(directTotalRevenue) === apiData.kpis?.totalRevenue;

  console.log("\n==================================================================");
  console.log("OVERALL RECONCILIATION SUMMARY:");
  console.log(`- Total Agents Match:   ${agentsMatch ? `PASSED (${totalAgentsCount} == ${apiData.kpis?.totalAgents})` : `FAILED (Direct=${totalAgentsCount} vs API=${apiData.kpis?.totalAgents})`}`);
  console.log(`- Active Agents Match:  ${activeMatch ? `PASSED (${activeAgentsCount} == ${apiData.kpis?.activeAgents})` : `FAILED (Direct=${activeAgentsCount} vs API=${apiData.kpis?.activeAgents})`}`);
  console.log(`- Total Leads Match:    ${leadsMatch ? `PASSED (${directTotalLeads} == ${apiData.kpis?.totalLeads})` : `FAILED (Direct=${directTotalLeads} vs API=${apiData.kpis?.totalLeads})`}`);
  console.log(`- Converted Match:      ${convMatch ? `PASSED (${directConverted} == ${apiData.kpis?.totalConverted})` : `FAILED (Direct=${directConverted} vs API=${apiData.kpis?.totalConverted})`}`);
  console.log(`- Conversion Rate Match:${rateMatch ? `PASSED (${directRate}% == ${apiData.kpis?.avgConversion}%)` : `FAILED (Direct=${directRate}% vs API=${apiData.kpis?.avgConversion}%)`}`);
  console.log(`- Total Revenue Match:  ${revMatch ? `PASSED (₹${Math.round(directTotalRevenue).toLocaleString('en-IN')} == ₹${apiData.kpis?.totalRevenue?.toLocaleString('en-IN')})` : `FAILED (Direct=₹${Math.round(directTotalRevenue).toLocaleString('en-IN')} vs API=₹${apiData.kpis?.totalRevenue?.toLocaleString('en-IN')})`}`);
  console.log("==================================================================");

  await mongoose.disconnect();
}

runOverallReconciliation().catch(console.error);
