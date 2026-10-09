const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const docsWithFields = await db.collection('employees').find({
    $or: [
      { employeeId: { $exists: true } },
      { empId: { $exists: true } },
      { teamLead: { $exists: true } },
      { tl: { $exists: true } },
      { reportingTo: { $exists: true } },
      { joiningDate: { $exists: true } },
      { dateOfJoining: { $exists: true } },
    ]
  }).toArray();
  console.log('Employees with custom fields count:', docsWithFields.length);
  if (docsWithFields.length > 0) {
    console.log('Sample matching employee:');
    console.log(docsWithFields[0]);
  }

  // Check if there are employees with role 'TEAM LEADER'
  const tls = await db.collection('employees').find({ role: { $in: ['TEAM LEADER', 'Team Leader', 'team leader', 'TL'] } }).toArray();
  console.log('\nEmployees with TL role count:', tls.length);
  if (tls.length > 0) {
    console.log('Sample TL:', tls[0].name, tls[0].branch);
  }

  // Also check User collection or Leads collection
  const sampleLead = await db.collection('leads').findOne({});
  console.log('\nSample Lead:', sampleLead);

  await mongoose.disconnect();
}

check().catch(console.error);
