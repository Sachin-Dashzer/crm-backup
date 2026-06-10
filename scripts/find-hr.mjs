import mongoose from "mongoose";

const MONGODB_URI = "mongodb://sachindashzer:user8520@ac-pu86ixj-shard-00-00.hwjor1r.mongodb.net:27017,ac-pu86ixj-shard-00-01.hwjor1r.mongodb.net:27017,ac-pu86ixj-shard-00-02.hwjor1r.mongodb.net:27017/?ssl=true&replicaSet=atlas-ool7b4-shard-0&authSource=admin&appName=crm";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

// Find all HR employees
const hrEmployees = await db.collection("employees").find({ role: "Hr" }).toArray();
console.log("HR Employees:", JSON.stringify(hrEmployees.map(e => ({ _id: e._id, name: e.name, role: e.role, email: e.email })), null, 2));

// Find all HR users
const hrUsers = await db.collection("users").find({ role: "hr" }).toArray();
console.log("HR Users:", JSON.stringify(hrUsers.map(u => ({ _id: u._id, name: u.name, email: u.email })), null, 2));

// Search for Pratibha with regex (case insensitive)
const fuzzy = await db.collection("employees").find({ name: { $regex: "pratibha", $options: "i" } }).toArray();
console.log("Fuzzy match employees:", JSON.stringify(fuzzy.map(e => ({ _id: e._id, name: e.name, role: e.role })), null, 2));

const fuzzyUser = await db.collection("users").find({ name: { $regex: "pratibha", $options: "i" } }).toArray();
console.log("Fuzzy match users:", JSON.stringify(fuzzyUser.map(u => ({ _id: u._id, name: u.name })), null, 2));

await mongoose.disconnect();
