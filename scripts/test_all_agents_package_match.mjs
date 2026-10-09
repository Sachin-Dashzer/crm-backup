import mongoose from 'mongoose';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

function normalizePackage(raw) {
  if (!raw) return 'Standard';
  const str = String(raw).trim();
  if (!str || str === '0') return 'Standard';
  const upper = str.toUpperCase().replace(/\s+/g, ' ');
  if (upper === 'FUE') return 'FUE';
  if (upper === 'INDIAN DHI' || upper === 'DHI INDIAN') return 'INDIAN DHI';
  if (upper === 'TURKISH DHI' || upper === 'DHI TURKEY' || upper === 'DHI TURKISH') return 'TURKISH DHI';
  if (upper === 'GFC') return 'GFC';
  if (upper === 'PRP') return 'PRP';
  if (upper === 'HYBRID' || upper === 'DHI HYBRID') return 'HYBRID';
  if (upper === 'ALOPECIA') return 'Alopecia';
  if (upper === 'OTHER') return 'Other';
  return str;
}

function getPatientPackage(p) {
  const ts = (typeof p.counselling?.techniqueSuggested === 'string' ? p.counselling.techniqueSuggested : '').trim();
  const st = (typeof p.surgery?.technique === 'string' ? p.surgery.technique : '').trim();
  const tq = (typeof p.personal?.techniqueQuoted === 'string' ? p.personal.techniqueQuoted : '').trim();
  const pq = (p.personal?.packageQuoted != null ? String(p.personal.packageQuoted) : '').trim();

  const selected = ts || st || tq || (pq && pq !== '0' ? pq : 'Standard') || 'Standard';
  return normalizePackage(selected);
}

async function testAllAgents() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const CONVERTED_STATUSES = ['SURGERY_BOOKED', 'BOOKING_DONE', 'CLOSED'];

  // Pipeline in MongoDB
  const pipeline = [
    {
      $project: {
        agentId: '$personal.reference',
        status: '$ops.status',
        package: {
          $let: {
            vars: {
              ts: { $trim: { input: { $ifNull: ['$counselling.techniqueSuggested', ''] } } },
              st: { $trim: { input: { $ifNull: ['$surgery.technique', ''] } } },
              tq: { $trim: { input: { $ifNull: ['$personal.techniqueQuoted', ''] } } },
              pq: { $trim: { input: { $ifNull: [{ $toString: '$personal.packageQuoted' }, ''] } } },
            },
            in: {
              $cond: [
                { $ne: ['$$ts', ''] },
                '$$ts',
                {
                  $cond: [
                    { $ne: ['$$st', ''] },
                    '$$st',
                    {
                      $cond: [
                        { $ne: ['$$tq', ''] },
                        '$$tq',
                        {
                          $cond: [
                            { $and: [{ $ne: ['$$pq', ''] }, { $ne: ['$$pq', '0'] }] },
                            '$$pq',
                            'Standard'
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        },
        converted: {
          $cond: [{ $in: ['$ops.status', CONVERTED_STATUSES] }, 1, 0]
        }
      }
    },
    {
      $match: {
        agentId: { $exists: true, $ne: null }
      }
    }
  ];

  const mongoDocs = await db.collection('patients').aggregate(pipeline).toArray();

  // Aggregate via Mongo projection + JS normalize
  const mongoAgg = new Map();
  mongoDocs.forEach(d => {
    const aId = String(d.agentId);
    const pkg = normalizePackage(d.package);
    if (!mongoAgg.has(aId)) mongoAgg.set(aId, {});
    const map = mongoAgg.get(aId);
    if (!map[pkg]) map[pkg] = { leads: 0, converted: 0 };
    map[pkg].leads += 1;
    if (d.converted) map[pkg].converted += 1;
  });

  // Direct DB JS over all referenced patients
  const directDocs = await db.collection('patients').find(
    { 'personal.reference': { $exists: true, $ne: null } },
    {
      projection: {
        'personal.reference': 1,
        'ops.status': 1,
        'counselling.techniqueSuggested': 1,
        'surgery.technique': 1,
        'personal.techniqueQuoted': 1,
        'personal.packageQuoted': 1,
      }
    }
  ).toArray();

  const directAgg = new Map();
  directDocs.forEach(p => {
    const aId = String(p.personal.reference);
    const pkg = getPatientPackage(p);
    const converted = CONVERTED_STATUSES.includes(p.ops?.status) ? 1 : 0;
    if (!directAgg.has(aId)) directAgg.set(aId, {});
    const map = directAgg.get(aId);
    if (!map[pkg]) map[pkg] = { leads: 0, converted: 0 };
    map[pkg].leads += 1;
    if (converted) map[pkg].converted += 1;
  });

  // Compare both aggregations
  let totalChecks = 0;
  let mismatches = 0;

  for (const [aId, directPkgs] of directAgg.entries()) {
    const mongoPkgs = mongoAgg.get(aId) || {};
    for (const [pkg, dStat] of Object.entries(directPkgs)) {
      totalChecks++;
      const mStat = mongoPkgs[pkg] || { leads: 0, converted: 0 };
      if (dStat.leads !== mStat.leads || dStat.converted !== mStat.converted) {
        mismatches++;
        console.error(`Mismatch for agent ${aId}, package ${pkg}: Direct=${JSON.stringify(dStat)} vs Mongo=${JSON.stringify(mStat)}`);
      }
    }
  }

  console.log(`Total Agent Package Comparisons: ${totalChecks}`);
  console.log(`Total Mismatches: ${mismatches}`);

  // Specifically check Aachal
  const aachalId = '691e9d24164751f6ae6a30b6';
  console.log('\nAachal Chaturvedi Direct:');
  console.log(directAgg.get(aachalId));
  console.log('\nAachal Chaturvedi Mongo Pipeline + Normalization:');
  console.log(mongoAgg.get(aachalId));

  await mongoose.disconnect();
}

testAllAgents().catch(console.error);
