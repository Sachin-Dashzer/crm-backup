import mongoose from 'mongoose';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

async function testPipeline() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const aachalId = new mongoose.Types.ObjectId('691e9d24164751f6ae6a30b6');

  const pipeline = [
    { $match: { 'personal.reference': aachalId } },
    {
      $project: {
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
        }
      }
    },
    {
      $group: {
        _id: '$package',
        count: { $sum: 1 }
      }
    }
  ];

  const res = await db.collection('patients').aggregate(pipeline).toArray();
  console.log('MongoDB Aggregation Results with $let & $trim:');
  console.table(res);

  await mongoose.disconnect();
}

testPipeline().catch(console.error);
