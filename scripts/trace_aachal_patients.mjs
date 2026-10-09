import mongoose from 'mongoose';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

async function trace() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const aachalId = new mongoose.Types.ObjectId('691e9d24164751f6ae6a30b6');

  const patients = await db.collection('patients').find({
    'personal.reference': aachalId
  }).toArray();

  console.log(`Total Patients for Aachal: ${patients.length}`);

  const rows = patients.map(p => {
    const ts = p.counselling?.techniqueSuggested;
    const st = p.surgery?.technique;
    const tq = p.personal?.techniqueQuoted;
    const pq = p.personal?.packageQuoted;
    const status = p.ops?.status;

    // Direct JS logic
    const tsClean = (typeof ts === 'string' ? ts : '').trim();
    const stClean = (typeof st === 'string' ? st : '').trim();
    const tqClean = (typeof tq === 'string' ? tq : '').trim();
    const pqClean = (pq != null ? String(pq) : '').trim();
    const directPackage = tsClean || stClean || tqClean || (pqClean && pqClean !== '0' ? pqClean : 'Standard') || 'Standard';

    // Old MongoDB $ifNull logic simulation
    const oldMongoFallback = (ts != null ? ts : (st != null ? st : (tq != null ? tq : (pq != null ? pq : 'Standard'))));
    const oldApiPackage = (oldMongoFallback && String(oldMongoFallback).trim() && String(oldMongoFallback).trim() !== '0')
      ? String(oldMongoFallback).trim()
      : 'Standard';

    return {
      _id: String(p._id),
      name: p.personal?.name,
      branch: p.personal?.branch,
      status,
      ts: JSON.stringify(ts),
      st: JSON.stringify(st),
      tq: JSON.stringify(tq),
      pq: JSON.stringify(pq),
      directPackage,
      oldApiPackage,
      isDiscrepancy: directPackage !== oldApiPackage
    };
  });

  const discrepancies = rows.filter(r => r.isDiscrepancy);
  console.log(`\nDiscrepancies found between Direct JS and Old $ifNull API logic: ${discrepancies.length}`);
  if (discrepancies.length > 0) {
    console.table(discrepancies);
  }

  // Count distribution with Direct JS
  const directCounts = {};
  rows.forEach(r => {
    directCounts[r.directPackage] = (directCounts[r.directPackage] || 0) + 1;
  });

  // Count distribution with Old API
  const oldApiCounts = {};
  rows.forEach(r => {
    oldApiCounts[r.oldApiPackage] = (oldApiCounts[r.oldApiPackage] || 0) + 1;
  });

  console.log('\nDirect Package Counts:');
  console.log(directCounts);

  console.log('\nOld API Package Counts:');
  console.log(oldApiCounts);

  // Let's also print ALL 17 FUE patients under Direct JS
  const fuePatients = rows.filter(r => r.directPackage.toUpperCase() === 'FUE');
  console.log(`\nAll 17 FUE Patients:`);
  console.table(fuePatients.map(p => ({
    _id: p._id,
    name: p.name,
    status: p.status,
    ts: p.ts,
    st: p.st,
    tq: p.tq,
    directPackage: p.directPackage,
    oldApiPackage: p.oldApiPackage
  })));

  await mongoose.disconnect();
}

trace().catch(console.error);
