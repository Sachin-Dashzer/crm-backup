const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // Let's see all unique keys in employees collection
  const allDocs = await db.collection('employees').find({}).toArray();
  const allKeys = new Set();
  allDocs.forEach(d => Object.keys(d).forEach(k => allKeys.add(k)));
  console.log('All keys across all employees:', Array.from(allKeys));

  // Check if any doc has tl or teamLead or manager or reporting
  allDocs.forEach(d => {
    ['tl', 'teamLead', 'team_lead', 'teamLeader', 'manager', 'reportingTo', 'reporting', 'supervisor'].forEach(k => {
      if (d[k]) {
        console.log(`Found ${k} on employee ${d.name}:`, d[k]);
      }
    });
  });

  // Check Aachal Chaturvedi specifically (mentioned in user prompt!)
  const aachal = await db.collection('employees').findOne({ name: /Aachal/i });
  console.log('\nAachal Chaturvedi:', aachal);

  // Check Patient.personal.reference for Aachal
  if (aachal) {
    const patientCount = await db.collection('patients').countDocuments({ 'personal.reference': aachal._id });
    const stringRefPatientCount = await db.collection('patients').countDocuments({ 'personal.reference': aachal._id.toString() });
    const nameRefPatientCount = await db.collection('patients').countDocuments({ 'personal.reference': aachal.name });
    console.log(`Patients referring to Aachal (ObjectId): ${patientCount}, (string): ${stringRefPatientCount}, (name): ${nameRefPatientCount}`);
    
    // Sample patient referring to Aachal
    const samplePatient = await db.collection('patients').findOne({ 'personal.reference': aachal._id });
    if (samplePatient) {
      console.log('Sample Patient referring to Aachal:', {
        _id: samplePatient._id,
        name: samplePatient.personal?.name,
        branch: samplePatient.personal?.branch,
        visitDate: samplePatient.personal?.visitDate,
        status: samplePatient.stage?.status || samplePatient.status,
        counselling: samplePatient.counselling,
        payments: samplePatient.payments,
      });
    }
  }

  await mongoose.disconnect();
}

check().catch(console.error);
