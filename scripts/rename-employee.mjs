import mongoose from "mongoose";

const MONGODB_URI = "mongodb://sachindashzer:user8520@ac-pu86ixj-shard-00-00.hwjor1r.mongodb.net:27017,ac-pu86ixj-shard-00-01.hwjor1r.mongodb.net:27017,ac-pu86ixj-shard-00-02.hwjor1r.mongodb.net:27017/?ssl=true&replicaSet=atlas-ool7b4-shard-0&authSource=admin&appName=crm";

const OLD_EMP_NAME  = "Hr Pratibha Mehto";   // Employee collection
const NEW_EMP_NAME  = "Hr Priya";
const OLD_USER_NAME = "Pratibha";             // User collection (login)
const NEW_USER_NAME = "Priya";

await mongoose.connect(MONGODB_URI);
console.log("Connected to MongoDB");

const db = mongoose.connection.db;

// 1. Employee collection
const empResult = await db.collection("employees").updateMany(
  { name: OLD_EMP_NAME },
  { $set: { name: NEW_EMP_NAME } }
);
console.log(`Employee collection: ${empResult.modifiedCount} record(s) updated`);

// 2. User collection (login account)
const userResult = await db.collection("users").updateMany(
  { name: OLD_USER_NAME },
  { $set: { name: NEW_USER_NAME } }
);
console.log(`User collection: ${userResult.modifiedCount} record(s) updated`);

// 3. Transactions — createdBy.name (both old variations)
for (const oldName of [OLD_EMP_NAME, OLD_USER_NAME]) {
  const r = await db.collection("transactions").updateMany(
    { "createdBy.name": oldName },
    { $set: { "createdBy.name": NEW_USER_NAME } }
  );
  if (r.modifiedCount) console.log(`Transactions createdBy ("${oldName}"): ${r.modifiedCount} record(s) updated`);
}

// 4. Transactions — editors[].name
for (const oldName of [OLD_EMP_NAME, OLD_USER_NAME]) {
  const r = await db.collection("transactions").updateMany(
    { "editors.name": oldName },
    { $set: { "editors.$[el].name": NEW_USER_NAME } },
    { arrayFilters: [{ "el.name": oldName }] }
  );
  if (r.modifiedCount) console.log(`Transactions editors ("${oldName}"): ${r.modifiedCount} record(s) updated`);
}

// 5. Patients — editors[].name
for (const oldName of [OLD_EMP_NAME, OLD_USER_NAME]) {
  const r = await db.collection("patients").updateMany(
    { "editors.name": oldName },
    { $set: { "editors.$[el].name": NEW_USER_NAME } },
    { arrayFilters: [{ "el.name": oldName }] }
  );
  if (r.modifiedCount) console.log(`Patients editors ("${oldName}"): ${r.modifiedCount} record(s) updated`);
}

// 6. Patients — createdBy.name
for (const oldName of [OLD_EMP_NAME, OLD_USER_NAME]) {
  const r = await db.collection("patients").updateMany(
    { "createdBy.name": oldName },
    { $set: { "createdBy.name": NEW_USER_NAME } }
  );
  if (r.modifiedCount) console.log(`Patients createdBy ("${oldName}"): ${r.modifiedCount} record(s) updated`);
}

await mongoose.disconnect();
console.log(`\nDone. "${OLD_EMP_NAME}" → "${NEW_EMP_NAME}" and "${OLD_USER_NAME}" (login) → "${NEW_USER_NAME}".`);
