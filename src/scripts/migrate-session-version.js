

import mongoose from 'mongoose';
import Transaction from '../models/Transactions.js';
import Patient from '../models/Patient.js';
import Stock from '../models/Stock.js';

// Update this with your MongoDB connection string
// const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-db-name';

async function migrateTransactions() {
  try {
    console.log('🚀 Starting Transaction Migration...\n');
    
    // Connect to database
    await mongoose.connect("mongodb+srv://sachindashzer:user8520@crm.hwjor1r.mongodb.net/");
    // await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Get total count before migration
    const totalBefore = await Transaction.countDocuments();
    console.log(`📊 Total transactions before migration: ${totalBefore}\n`);

    // Find all transactions without transactionCategory
    const transactionsToMigrate = await Transaction.find({
      transactionCategory: { $exists: false }
    });

    console.log(`🔄 Transactions to migrate: ${transactionsToMigrate.length}\n`);

    let migratedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const transaction of transactionsToMigrate) {
      try {
        const updates = {};

        // 1. Determine transactionCategory
        if (transaction.costType === 'Revenue') {
          if (['Sapphire FUE', 'DHI', 'Turkish DHI', 'Beard Transplant'].includes(transaction.procedure)) {
            updates.transactionCategory = 'TRANSPLANT';
          } else if (['PRP', 'GFC'].includes(transaction.procedure)) {
            updates.transactionCategory = 'SERVICE';
            // For SERVICE, set quantity and perSessionCost
            updates.quantity = 1; // Default to 1 session
            updates.perSessionCost = transaction.amount;
          } else if (transaction.procedure === 'Medicine') {
            updates.transactionCategory = 'MEDICINE';
            // If stock reference exists, set medicineId
            if (transaction.stock) {
              updates.medicineId = transaction.stock;
              updates.quantity = 1; // Default quantity
              updates.perUnitCost = transaction.amount;
            }
          } else {
            updates.transactionCategory = 'SERVICE'; // Default to SERVICE for other revenue
          }
        } else if (transaction.costType === 'Expenses') {
          updates.transactionCategory = 'EXPENSE';
          
          // Migrate expenseGiver field
          if (transaction.vendor) {
            updates.expenseGiver = {
              type: 'VENDOR',
              vendorId: transaction.vendor,
              name: '' // Will be populated from vendor
            };
          } else if (transaction.expenseGiverOld || transaction.expense) {
            updates.expenseGiver = {
              type: 'MANUAL',
              name: transaction.expenseGiverOld || transaction.expense || 'Unknown'
            };
          }
        }

        // 2. Populate patient name and phone if patient exists
        if (transaction.patient) {
          const patient = await Patient.findById(transaction.patient)
            .select('personal.name personal.phone');
          
          if (patient) {
            updates.patientName = patient.personal?.name || '';
            updates.patientPhone = patient.personal?.phone || '';
          }
        }

        // 3. Update the transaction
        await Transaction.findByIdAndUpdate(
          transaction._id,
          { $set: updates },
          { new: true }
        );

        migratedCount++;
        
        // Show progress every 100 transactions
        if (migratedCount % 100 === 0) {
          console.log(`   Migrated ${migratedCount} transactions...`);
        }

      } catch (error) {
        errorCount++;
        errors.push({
          transactionId: transaction._id,
          error: error.message
        });
        console.error(`❌ Error migrating transaction ${transaction._id}: ${error.message}`);
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${migratedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total processed: ${transactionsToMigrate.length}\n`);

    // Verify counts
    const totalAfter = await Transaction.countDocuments();
    const transplantCount = await Transaction.countDocuments({ transactionCategory: 'TRANSPLANT' });
    const serviceCount = await Transaction.countDocuments({ transactionCategory: 'SERVICE' });
    const medicineCount = await Transaction.countDocuments({ transactionCategory: 'MEDICINE' });
    const expenseCount = await Transaction.countDocuments({ transactionCategory: 'EXPENSE' });

    console.log('📊 Post-Migration Counts:');
    console.log(`   Total transactions: ${totalAfter}`);
    console.log(`   TRANSPLANT: ${transplantCount}`);
    console.log(`   SERVICE: ${serviceCount}`);
    console.log(`   MEDICINE: ${medicineCount}`);
    console.log(`   EXPENSE: ${expenseCount}\n`);

    // Verify integrity
    if (totalBefore === totalAfter) {
      console.log('✅ Data integrity verified: No transactions lost\n');
    } else {
      console.log('⚠️  Warning: Transaction count mismatch!\n');
    }

    if (errors.length > 0) {
      console.log('❌ Errors encountered:');
      errors.forEach(err => {
        console.log(`   Transaction ${err.transactionId}: ${err.error}`);
      });
    }

    console.log('✅ Migration completed!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run migration
migrateTransactions();