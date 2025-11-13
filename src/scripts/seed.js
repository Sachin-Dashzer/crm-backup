const mongoose = require('mongoose');

async function seed() {
  await mongoose.connect('mongodb://localhost:27017/clinic-crm');
  console.log('✓ Database seeded');
  process.exit(0);
}
seed();
