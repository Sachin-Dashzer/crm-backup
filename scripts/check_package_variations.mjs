import mongoose from 'mongoose';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

async function checkAllPackages() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const allPatients = await db.collection('patients').find(
    { 'personal.reference': { $exists: true, $ne: null } },
    {
      projection: {
        'personal.reference': 1,
        'counselling.techniqueSuggested': 1,
        'surgery.technique': 1,
        'personal.techniqueQuoted': 1,
        'personal.packageQuoted': 1,
      }
    }
  ).toArray();

  const rawPackages = new Set();
  const trimmedPackages = new Set();
  const upperPackages = new Set();

  allPatients.forEach(p => {
    const ts = p.counselling?.techniqueSuggested;
    const st = p.surgery?.technique;
    const tq = p.personal?.techniqueQuoted;
    const pq = p.personal?.packageQuoted;

    const tsClean = (typeof ts === 'string' ? ts : '').trim();
    const stClean = (typeof st === 'string' ? st : '').trim();
    const tqClean = (typeof tq === 'string' ? tq : '').trim();
    const pqClean = (pq != null ? String(pq) : '').trim();

    const selected = tsClean || stClean || tqClean || (pqClean && pqClean !== '0' ? pqClean : 'Standard') || 'Standard';

    rawPackages.add(selected);
    trimmedPackages.add(selected.trim());
    upperPackages.add(selected.trim().toUpperCase());
  });

  console.log('Distinct raw selected:', Array.from(rawPackages));
  console.log('Distinct upper selected:', Array.from(upperPackages));

  await mongoose.disconnect();
}

checkAllPackages().catch(console.error);
