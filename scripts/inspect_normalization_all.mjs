import mongoose from 'mongoose';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

async function inspectAll() {
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

  console.log('Total referenced patients in DB:', allPatients.length);

  const whitespaceCases = [];
  const caseVariations = new Map();

  allPatients.forEach(p => {
    const ts = p.counselling?.techniqueSuggested;
    const st = p.surgery?.technique;
    const tq = p.personal?.techniqueQuoted;
    const pq = p.personal?.packageQuoted;

    [ts, st, tq, pq].forEach(v => {
      if (typeof v === 'string') {
        if (v !== v.trim()) whitespaceCases.push({ id: p._id, val: v });
        const lower = v.trim().toLowerCase();
        if (lower) {
          if (!caseVariations.has(lower)) caseVariations.set(lower, new Set());
          caseVariations.get(lower).add(v.trim());
        }
      }
    });
  });

  console.log('Whitespace cases count:', whitespaceCases.length);
  if (whitespaceCases.length > 0) {
    console.log('Sample whitespace cases (up to 10):', whitespaceCases.slice(0, 10));
  }

  console.log('\nCase variations (different casings for same normalized term):');
  for (const [lower, set] of caseVariations.entries()) {
    if (set.size > 1) {
      console.log(`  '${lower}':`, Array.from(set));
    }
  }

  await mongoose.disconnect();
}

inspectAll().catch(console.error);
