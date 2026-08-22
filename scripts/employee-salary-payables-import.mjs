
import mongoose from "mongoose";
import fs from "fs";

// --- env -----------------------------------------------------------------
for (const f of [".env.local", ".env"]) {
  if (fs.existsSync(f)) {
    try {
      process.loadEnvFile(f);
    } catch {
      /* already loaded / unsupported — fall through to the MONGODB_URI check below */
    }
  }
}
const MONGODB_URI = process.env.MONGODB_URI;

// ═══════════════════════════════════════════════════════════════════════════════
// THE DATA — parsed and deduplicated from emp_2.txt (see header notes above for exactly what
// was excluded and why). One entry per employee for July 2026.
// ═══════════════════════════════════════════════════════════════════════════════
const SALARY_ROWS = [
  {
    "employeeName": "pradeep kumar",
    "employeePhoneRaw": "9311904205",
    "employeePhone": "9311904205",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 32448,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "GUDIYA",
    "employeePhoneRaw": "9582273771",
    "employeePhone": "9582273771",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12661,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "PRATEEK",
    "employeePhoneRaw": "7011630210",
    "employeePhone": "7011630210",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13774,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "RAHUL",
    "employeePhoneRaw": "9217063109",
    "employeePhone": "9217063109",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14400,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Sunita",
    "employeePhoneRaw": "8506945662",
    "employeePhone": "8506945662",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14416,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "POOJA",
    "employeePhoneRaw": "9205091244",
    "employeePhone": "9205091244",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "MUMTAJ",
    "employeePhoneRaw": "9667436799",
    "employeePhone": "9667436799",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Shaheen",
    "employeePhoneRaw": "7247868055",
    "employeePhone": "7247868055",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14032,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Aisha Khan",
    "employeePhoneRaw": "7428922270",
    "employeePhone": "7428922270",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13419,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Aisha Parveen (Inactive)",
    "employeePhoneRaw": "9971915865",
    "employeePhone": "9971915865",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 6048,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Harshita Rai",
    "employeePhoneRaw": "7827516971",
    "employeePhone": "7827516971",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Tanu Thakur",
    "employeePhoneRaw": "9355170574",
    "employeePhone": "9355170574",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 16500,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Anjali Kumari Gudiya",
    "employeePhoneRaw": "9310767886",
    "employeePhone": "9310767886",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 17700,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Aachal Chaturvedi",
    "employeePhoneRaw": "8448306374",
    "employeePhone": "8448306374",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12097,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "ANAM",
    "employeePhoneRaw": "7042124866",
    "employeePhone": "7042124866",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 20000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Nikita Nikki",
    "employeePhoneRaw": "8750887588",
    "employeePhone": "8750887588",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 19000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Nikita Yadav",
    "employeePhoneRaw": "9821574518",
    "employeePhone": "9821574518",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 20000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Khushi Jindhad",
    "employeePhoneRaw": "9319348554",
    "employeePhone": "9319348554",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15484,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "Sushma",
    "employeePhoneRaw": "9971381020",
    "employeePhone": "9971381020",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9194,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Himanshi",
    "employeePhoneRaw": "9718299194",
    "employeePhone": "9718299194",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14516,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Anjali singh",
    "employeePhoneRaw": "7303878190",
    "employeePhone": "7303878190",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 1935,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Tulsi",
    "employeePhoneRaw": "9217188694",
    "employeePhone": "9217188694",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12710,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Vipin Singh",
    "employeePhoneRaw": "7042919593",
    "employeePhone": "7042919593",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 27581,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Shubham Chitransh",
    "employeePhoneRaw": "7766839176",
    "employeePhone": "7766839176",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 34435,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "KIRAN",
    "employeePhoneRaw": "9873343501",
    "employeePhone": "9873343501",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15484,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "LUCKY",
    "employeePhoneRaw": "7217767823",
    "employeePhone": "7217767823",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14516,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "BEAUTY CHAUDHARY",
    "employeePhoneRaw": "9717674612",
    "employeePhone": "9717674612",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14032,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "AMIT JHA",
    "employeePhoneRaw": "7210005148",
    "employeePhone": "7210005148",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 41094,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "SACHIN KUMAR",
    "employeePhoneRaw": "8287037611",
    "employeePhone": "8287037611",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 40000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "RAHUL VASHISHTA",
    "employeePhoneRaw": "8766334717",
    "employeePhone": "8766334717",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 85000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "JANVI GUPTA",
    "employeePhoneRaw": "9958503105",
    "employeePhone": "9958503105",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 16000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "ANJALI MATHUR",
    "employeePhoneRaw": "9310575142",
    "employeePhone": "9310575142",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12900,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "NISHA MAHOUR (Inactive)",
    "employeePhoneRaw": "8383903389",
    "employeePhone": "8383903389",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 1210,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "ANISH CHAUHAN",
    "employeePhoneRaw": "8851050270",
    "employeePhone": "8851050270",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "RINKI YADAV",
    "employeePhoneRaw": "9335355889",
    "employeePhone": "9335355889",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 16000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "ROZY (Inactive)",
    "employeePhoneRaw": "8287819671",
    "employeePhone": "8287819671",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 4613,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "MANISHA KUMARI",
    "employeePhoneRaw": "8287178328",
    "employeePhone": "8287178328",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12161,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Sheetal Rathour",
    "employeePhoneRaw": "9354232491",
    "employeePhone": "9354232491",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12790,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Sant Vijiy",
    "employeePhoneRaw": "9990622469",
    "employeePhone": "9990622469",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 16258,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Shaifali",
    "employeePhoneRaw": "9205049061",
    "employeePhone": "9205049061",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Anjali Sharma",
    "employeePhoneRaw": "9354003546",
    "employeePhone": "9354003546",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12790,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Farheen Ansari",
    "employeePhoneRaw": "7065457004",
    "employeePhone": "7065457004",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 8226,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Jassica",
    "employeePhoneRaw": "8860257729",
    "employeePhone": "8860257729",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Nitika",
    "employeePhoneRaw": "7827900974",
    "employeePhone": "7827900974",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15642,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Muskan Sharma",
    "employeePhoneRaw": "8527541877",
    "employeePhone": "8527541877",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 18710,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Kumkum Rajput (Inactive)",
    "employeePhoneRaw": "9718587101",
    "employeePhone": "9718587101",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12581,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Himanshu Verma",
    "employeePhoneRaw": "9212131233",
    "employeePhone": "9212131233",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 21777,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Khushbu Mathur",
    "employeePhoneRaw": "9318481377",
    "employeePhone": "9318481377",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9965,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Palak Singh",
    "employeePhoneRaw": "9643694314",
    "employeePhone": "9643694314",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 8000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Shama Nilofar",
    "employeePhoneRaw": "9310954658",
    "employeePhone": "9310954658",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 10245,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Alisha (Inactive)",
    "employeePhoneRaw": "8527753871",
    "employeePhone": "8527753871",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 5032,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Sufiyan",
    "employeePhoneRaw": "7037170762",
    "employeePhone": "7037170762",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15977,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Himanshi Kaushik",
    "employeePhoneRaw": "8882750475",
    "employeePhone": "8882750475",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Rajesh Sahu",
    "employeePhoneRaw": "8743833878",
    "employeePhone": "8743833878",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12700,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Annu Kumari",
    "employeePhoneRaw": "9310019584",
    "employeePhone": "9310019584",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Himanshi Chouhan",
    "employeePhoneRaw": "9310517194",
    "employeePhone": "9310517194",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13306,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Muskan Sayed",
    "employeePhoneRaw": "9667970342",
    "employeePhone": "9667970342",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 18065,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Ankit Gaur",
    "employeePhoneRaw": "7827241534",
    "employeePhone": "7827241534",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9116,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Mansi Gupta",
    "employeePhoneRaw": "9899910359",
    "employeePhone": "9899910359",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12381,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Ayushi",
    "employeePhoneRaw": "9873229107",
    "employeePhone": "9873229107",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Rajat Kumar (Inactive)",
    "employeePhoneRaw": "9354100637",
    "employeePhone": "9354100637",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 6290,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Nitin Sahu (Inactive)",
    "employeePhoneRaw": "9654816403",
    "employeePhone": "9654816403",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 4613,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Priyam Bhuteja",
    "employeePhoneRaw": "8076676431",
    "employeePhone": "8076676431",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 22000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Lavanya Thapa",
    "employeePhoneRaw": "9266865966",
    "employeePhone": "9266865966",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 8129,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Arman Malik",
    "employeePhoneRaw": "7982653957",
    "employeePhone": "7982653957",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Ayush Srivavastav",
    "employeePhoneRaw": "8595382355",
    "employeePhone": "8595382355",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12790,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Nikhil Arora (Inactive)",
    "employeePhoneRaw": "7835858826",
    "employeePhone": "7835858826",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9755,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Simranjeet Kaur",
    "employeePhoneRaw": "7701955098",
    "employeePhone": "7701955098",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13419,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Manmeet Singh",
    "employeePhoneRaw": "7827692262",
    "employeePhone": "7827692262",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12097,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Ramandeep Singh (Inactive)",
    "employeePhoneRaw": "9871094208",
    "employeePhone": "9871094208",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 4613,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Ashu",
    "employeePhoneRaw": "7838699102",
    "employeePhone": "7838699102",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 30000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Harsh Kumar",
    "employeePhoneRaw": "9990647635",
    "employeePhone": "9990647635",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12965,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Preeti",
    "employeePhoneRaw": "8742943698",
    "employeePhone": "8742943698",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 2661,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Simran Kaur",
    "employeePhoneRaw": "9818967992",
    "employeePhone": "9818967992",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14758,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Santosh Kumar (Inactive)",
    "employeePhoneRaw": "9310495297",
    "employeePhone": "9310495297",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 226,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Meenu",
    "employeePhoneRaw": "9667901689",
    "employeePhone": "9667901689",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Om Upadhyay (Inactive)",
    "employeePhoneRaw": "9289458588",
    "employeePhone": "9289458588",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 710,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Muskan Verma (Inactive)",
    "employeePhoneRaw": "7065774487",
    "employeePhone": "7065774487",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 6500,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Harshita Sharma",
    "employeePhoneRaw": "8287282774",
    "employeePhone": "8287282774",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Kiran Sharma",
    "employeePhoneRaw": "8750116723",
    "employeePhone": "8750116723",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 10742,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "JYOTI kumari",
    "employeePhoneRaw": "9355658634",
    "employeePhone": "9355658634",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 4968,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "Bindu Kumari",
    "employeePhoneRaw": "8287116552",
    "employeePhone": "8287116552",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12500,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Leeza",
    "employeePhoneRaw": "8178091651",
    "employeePhone": "8178091651",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 6290,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Sudhanshu Sharma",
    "employeePhoneRaw": "9558054826",
    "employeePhone": "9558054826",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Harsha",
    "employeePhoneRaw": "7982325787",
    "employeePhone": "7982325787",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12371,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Bhoomika Mehta",
    "employeePhoneRaw": "9717067547",
    "employeePhone": "9717067547",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12645,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Nandni",
    "employeePhoneRaw": "8882861940",
    "employeePhone": "8882861940",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 11226,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Babita Negi",
    "employeePhoneRaw": "9999224629",
    "employeePhone": "9999224629",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 10065,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Sneha Yadav",
    "employeePhoneRaw": "7303360478",
    "employeePhone": "7303360478",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9645,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Chandani",
    "employeePhoneRaw": "9315502234",
    "employeePhone": "9315502234",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 10064,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Vidit",
    "employeePhoneRaw": "9999154046",
    "employeePhone": "9999154046",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 11226,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Payal Sharma (Inactive)",
    "employeePhoneRaw": "8059642660",
    "employeePhone": "8059642660",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 1258,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Praveen",
    "employeePhoneRaw": "9958331811",
    "employeePhone": "9958331811",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13900,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Priya Sharma (Inactive)",
    "employeePhoneRaw": "9625224560",
    "employeePhone": "9625224560",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 6387,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Gautam Pawar",
    "employeePhoneRaw": "9097461326",
    "employeePhone": "9097461326",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 11000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Prabhjot",
    "employeePhoneRaw": "7835904952",
    "employeePhone": "7835904952",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13348,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Surbhi Joshi (Inactive)",
    "employeePhoneRaw": "9968629888",
    "employeePhone": "9968629888",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 2177,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Arti Salal (Inactive)",
    "employeePhoneRaw": "7078647252",
    "employeePhone": "7078647252",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 8029,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Urvashi",
    "employeePhoneRaw": "9582958796",
    "employeePhone": "9582958796",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 7548,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Lalbabu Kumar",
    "employeePhoneRaw": "9667281607",
    "employeePhone": "9667281607",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Lovely",
    "employeePhoneRaw": "8766268660",
    "employeePhone": "8766268660",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13900,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Nancy Pateriaya",
    "employeePhoneRaw": "7580992054",
    "employeePhone": "7580992054",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 11961,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Priya Kumari",
    "employeePhoneRaw": "7678530427",
    "employeePhone": "7678530427",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14700,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Hasad",
    "employeePhoneRaw": "7982854287",
    "employeePhone": "7982854287",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 11013,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Nitish Yadav",
    "employeePhoneRaw": "8882534458",
    "employeePhone": "8882534458",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13500,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Vansh Kumar",
    "employeePhoneRaw": "9718688350",
    "employeePhone": "9718688350",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9965,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Nisha Rajput",
    "employeePhoneRaw": "8287377747",
    "employeePhone": "8287377747",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 8887,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Faiz",
    "employeePhoneRaw": "8057928785",
    "employeePhone": "8057928785",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Khushi Goswami (Inactive)",
    "employeePhoneRaw": "9873885016",
    "employeePhone": "9873885016",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 7863,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Himanshi Rawat (Inactive)",
    "employeePhoneRaw": "8882929649",
    "employeePhone": "8882929649",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9816,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "KHUSHBOO",
    "employeePhoneRaw": "9540935930",
    "employeePhone": "9540935930",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13000,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "Komal Lodhi",
    "employeePhoneRaw": "6391263383",
    "employeePhone": "6391263383",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 11742,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Bhoomi Kumari Chaurasia",
    "employeePhoneRaw": "8777385568",
    "employeePhone": "8777385568",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9677,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Ashu Kumar",
    "employeePhoneRaw": "7703900134",
    "employeePhone": "7703900134",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 7839,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Shubhangi",
    "employeePhoneRaw": "8076577693",
    "employeePhone": "8076577693",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9879,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Sakshi Saroj",
    "employeePhoneRaw": "9289121830",
    "employeePhone": "9289121830",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 10368,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Anjali Rana (Left)",
    "employeePhoneRaw": "9013350101",
    "employeePhone": "9013350101",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 3919,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Chandan Riswal (Inactive)",
    "employeePhoneRaw": "9953777962",
    "employeePhone": "9953777962",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9016,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Isha Chandel",
    "employeePhoneRaw": "9717892623",
    "employeePhone": "9717892623",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Sandhya Maurya",
    "employeePhoneRaw": "9076757393",
    "employeePhone": "9076757393",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Ashwani (Inactive)",
    "employeePhoneRaw": "9319400367",
    "employeePhone": "9319400367",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 11742,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Bharat Goswami",
    "employeePhoneRaw": "8527193995",
    "employeePhone": "8527193995",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 100000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Sushant Choudhary",
    "employeePhoneRaw": "8287443498",
    "employeePhone": "8287443498",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 130000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Md Ayan",
    "employeePhoneRaw": "8810517020",
    "employeePhone": "8810517020",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12865,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Amit (Inactive)",
    "employeePhoneRaw": "8595964518",
    "employeePhone": "8595964518",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 194,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Ankit Pratap (Inactive)",
    "employeePhoneRaw": "8376020072",
    "employeePhone": "8376020072",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9290,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Deepak",
    "employeePhoneRaw": "9818810898",
    "employeePhone": "9818810898",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 17900,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Roli Rajbhar (Inactive)",
    "employeePhoneRaw": "8285321925",
    "employeePhone": "8285321925",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9852,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Cutee (Inactive)",
    "employeePhoneRaw": "9312318575",
    "employeePhone": "9312318575",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 8516,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Devraj",
    "employeePhoneRaw": "9953365762",
    "employeePhone": "9953365762",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 11652,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Gopal Parasar (Inactive)",
    "employeePhoneRaw": "8076044470",
    "employeePhone": "8076044470",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 1290,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Dr Rithika Shaw",
    "employeePhoneRaw": "8697444936",
    "employeePhone": "8697444936",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 21774,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Piyush (Inactive)",
    "employeePhoneRaw": "8178433668",
    "employeePhone": "8178433668",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 419,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Jayant Kumar",
    "employeePhoneRaw": "8448153149",
    "employeePhone": "8448153149",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 1806,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Aman Patwal",
    "employeePhoneRaw": "9711180932",
    "employeePhone": "9711180932",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 25000,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Anuruddh pratap patel",
    "employeePhoneRaw": "7489056299",
    "employeePhone": "7489056299",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 16500,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Vishal Kumar",
    "employeePhoneRaw": "7632977168",
    "employeePhone": "7632977168",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13097,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Neha Mandal (Inactive)",
    "employeePhoneRaw": "9315532616",
    "employeePhone": "9315532616",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 2516,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Ishant (Inactive)",
    "employeePhoneRaw": "8851341252",
    "employeePhone": "8851341252",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 1306,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Annu Verma (Inactive)",
    "employeePhoneRaw": "7827562612",
    "employeePhone": "7827562612",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 3024,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Santoshi Kumari",
    "employeePhoneRaw": "9354973704",
    "employeePhone": "9354973704",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 11806,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Manisha",
    "employeePhoneRaw": "9811547639",
    "employeePhone": "9811547639",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13065,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Anuj",
    "employeePhoneRaw": "7835851136",
    "employeePhone": "7835851136",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12481,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Prachi",
    "employeePhoneRaw": "8595957402",
    "employeePhone": "8595957402",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13065,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "SIMRAN",
    "employeePhoneRaw": "9718493850",
    "employeePhone": "9718493850",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 17419,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Rashi",
    "employeePhoneRaw": "8448747204",
    "employeePhone": "8448747204",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 10803,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Lakshman",
    "employeePhoneRaw": "9311218921",
    "employeePhone": "9311218921",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12387,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Kirti",
    "employeePhoneRaw": "8130953354",
    "employeePhone": "8130953354",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 8973,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Ishank Goel (Inactive)",
    "employeePhoneRaw": "7217663865",
    "employeePhone": "7217663865",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 3355,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Ashish Sharma (Inactive)",
    "employeePhoneRaw": "9667441983",
    "employeePhone": "9667441983",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 6500,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Nisha Koli",
    "employeePhoneRaw": "9354955331",
    "employeePhone": "9354955331",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9677,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Varsha",
    "employeePhoneRaw": "9625869227",
    "employeePhone": "9625869227",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 2032,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Tannu",
    "employeePhoneRaw": "9821920433",
    "employeePhone": "9821920433",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 10384,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Abhishek",
    "employeePhoneRaw": "9634938655",
    "employeePhone": "9634938655",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 10903,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Kashish Waris",
    "employeePhoneRaw": "8851498657",
    "employeePhone": "8851498657",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 10484,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Manisha Negi",
    "employeePhoneRaw": "9643296140",
    "employeePhone": "9643296140",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 21935,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Poonam",
    "employeePhoneRaw": "9311975648",
    "employeePhone": "9311975648",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 8226,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Farha",
    "employeePhoneRaw": "9873533636",
    "employeePhone": "9873533636",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 5032,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Nikita",
    "employeePhoneRaw": "8447565683",
    "employeePhone": "8447565683",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 968,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Mohd Kaif",
    "employeePhoneRaw": "8700495134",
    "employeePhone": "8700495134",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 210,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Dhruv Nirmal",
    "employeePhoneRaw": "6230331340",
    "employeePhone": "6230331340",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 3484,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Rukhsar",
    "employeePhoneRaw": "8860733585",
    "employeePhone": "8860733585",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 3355,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "Tannushri",
    "employeePhoneRaw": "8285520882",
    "employeePhone": "8285520882",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 2097,
    "branchTag": "Backend",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Backend] July 2026 salary"
  },
  {
    "employeeName": "ABDUL",
    "employeePhoneRaw": "7235029269",
    "employeePhone": "7235029269",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 18000,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "SHIVAM RAI",
    "employeePhoneRaw": "7838826632",
    "employeePhone": "7838826632",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14016,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "DURGESH GUPTA",
    "employeePhoneRaw": "9289147963",
    "employeePhone": "9289147963",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15000,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "VAASHU",
    "employeePhoneRaw": "9999216811",
    "employeePhone": "9999216811",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 35000,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "AMIT KUMAR",
    "employeePhoneRaw": "6283884492",
    "employeePhone": "6283884492",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 29032,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "NISHANT KUSHWAHA",
    "employeePhoneRaw": "8171385980",
    "employeePhone": "8171385980",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 85000,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "CHANDAN KUMAR",
    "employeePhoneRaw": "9334059199",
    "employeePhone": "9334059199",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 4839,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "JATIN",
    "employeePhoneRaw": "8700130897",
    "employeePhone": "8700130897",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 16258,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "SANJAY Kumar(old)",
    "employeePhoneRaw": "7838010543",
    "employeePhone": "7838010543",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 70000,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "PRITAM",
    "employeePhoneRaw": "8824185718",
    "employeePhone": "8824185718",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 23387,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "GOURI SAGAR",
    "employeePhoneRaw": "9266571543",
    "employeePhone": "9266571543",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 18000,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "SANDHYA YADAV",
    "employeePhoneRaw": "9198545935",
    "employeePhone": "9198545935",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13000,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "Yogesh Gupta",
    "employeePhoneRaw": "9667499969",
    "employeePhone": "9667499969",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12000,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "VIKAS BAIRWA",
    "employeePhoneRaw": "8058193092",
    "employeePhone": "8058193092",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 10000,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "ANJALI CHOUDHARY",
    "employeePhoneRaw": "9821737758",
    "employeePhone": "9821737758",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15000,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "KAVITA BORA",
    "employeePhoneRaw": "9582812921",
    "employeePhone": "9582812921",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 19355,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "RAVI KUMAR",
    "employeePhoneRaw": "7579782314",
    "employeePhone": "7579782314",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 24194,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "UTKARSH",
    "employeePhoneRaw": "9319432592",
    "employeePhone": "9319432592",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 10000,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "NITESH NIKKI",
    "employeePhoneRaw": "9205069771",
    "employeePhone": "9205069771",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 35000,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "Dr Mansi",
    "employeePhoneRaw": "8755211994",
    "employeePhone": "8755211994",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 23500,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "Nilesh",
    "employeePhoneRaw": "9756722934",
    "employeePhone": "9756722934",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 54194,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "Md Sarfaraz",
    "employeePhoneRaw": "9625670667",
    "employeePhone": "9625670667",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 6774,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "Amaan Mirza",
    "employeePhoneRaw": "9810334104",
    "employeePhone": "9810334104",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 33871,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "Yogesh Kumar Insha",
    "employeePhoneRaw": "8306206226",
    "employeePhone": "8306206226",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 11290,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "Aachal Kanaujiya",
    "employeePhoneRaw": "8423674383",
    "employeePhone": "8423674383",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 11000,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "Pushkar Chaudhary",
    "employeePhoneRaw": "9870581915",
    "employeePhone": "9870581915",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 16258,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "Mansi Rai",
    "employeePhoneRaw": "8826310277",
    "employeePhone": "8826310277",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15484,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "Pramod",
    "employeePhoneRaw": "7409469982",
    "employeePhone": "7409469982",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 2258,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "Khushman Kumar",
    "employeePhoneRaw": "9988309081",
    "employeePhone": "9988309081",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9355,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "Dr Ashi Gautam",
    "employeePhoneRaw": "7985464228",
    "employeePhone": "7985464228",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 548,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "Samad Saifi",
    "employeePhoneRaw": "7457880023",
    "employeePhone": "7457880023",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 16839,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "Mohammad Nadeem",
    "employeePhoneRaw": "8318789737",
    "employeePhone": "8318789737",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12000,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "Sayed Noman",
    "employeePhoneRaw": "9599259259",
    "employeePhone": "9599259259",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14032,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "Dr Sumedha Sagar",
    "employeePhoneRaw": "9818970672",
    "employeePhone": "9818970672",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 10645,
    "branchTag": "Vaishali",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Vaishali] July 2026 salary"
  },
  {
    "employeeName": "ARCHANA",
    "employeePhoneRaw": "8076350538",
    "employeePhone": "8076350538",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 18000,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "GUNJAN RAO",
    "employeePhoneRaw": "9818697541",
    "employeePhone": "9818697541",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 18000,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "RITIKA",
    "employeePhoneRaw": "8375973428",
    "employeePhone": "8375973428",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 18000,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Sheetal Bhatiya",
    "employeePhoneRaw": "7988415814",
    "employeePhone": "7988415814",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 33600,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "PRAKASH KUMAR",
    "employeePhoneRaw": "9341678146",
    "employeePhone": "9341678146",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 88871,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "PANKAJ",
    "employeePhoneRaw": "8958449464",
    "employeePhone": "8958449464",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 84194,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "REETU",
    "employeePhoneRaw": "9310157897",
    "employeePhone": "9310157897",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14516,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "MOHIT SHAH",
    "employeePhoneRaw": "9911025644",
    "employeePhone": "9911025644",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 18065,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "YASHIKA",
    "employeePhoneRaw": "9667932450",
    "employeePhone": "9667932450",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9629,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "SATYAM RAI",
    "employeePhoneRaw": "9654101962",
    "employeePhone": "9654101962",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9032,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "BABITA",
    "employeePhoneRaw": "8933064653",
    "employeePhone": "8933064653",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13065,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "RAVI KUSHWAHA",
    "employeePhoneRaw": "7037595070",
    "employeePhone": "7037595070",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12581,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "dinesh",
    "employeePhoneRaw": "9821756097",
    "employeePhone": "9821756097",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15000,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Sourabh Kumar",
    "employeePhoneRaw": "9956130556",
    "employeePhone": "9956130556",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15000,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Priyanka Shaw",
    "employeePhoneRaw": "9565794503",
    "employeePhone": "9565794503",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14200,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Kamal Bairwa",
    "employeePhoneRaw": "8058892785",
    "employeePhone": "8058892785",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9255,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Manmohan Bairwa",
    "employeePhoneRaw": "7877279502",
    "employeePhone": "7877279502",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 10000,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Deepak Kushwaha",
    "employeePhoneRaw": "8882323429",
    "employeePhone": "8882323429",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 100000,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Abhijeet Kumar Mandal",
    "employeePhoneRaw": "8527691963",
    "employeePhone": "8527691963",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 5806,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Dr Ashalata Roy",
    "employeePhoneRaw": "9971125678",
    "employeePhone": "9971125678",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 25161,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "NITIN",
    "employeePhoneRaw": "9958488965",
    "employeePhone": "9958488965",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 4032,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Mukesh Kushwaha",
    "employeePhoneRaw": "7409698060",
    "employeePhone": "7409698060",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 7742,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Marzia Halim",
    "employeePhoneRaw": "9625521850",
    "employeePhone": "9625521850",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 30000,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Zohra Halim",
    "employeePhoneRaw": "9899815339",
    "employeePhone": "9899815339",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 24597,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Salman Toto",
    "employeePhoneRaw": "9315173962",
    "employeePhone": "9315173962",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14516,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Rashida Langary",
    "employeePhoneRaw": "8373986054",
    "employeePhone": "8373986054",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 23000,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Hangama Sayedy",
    "employeePhoneRaw": "9821017296",
    "employeePhone": "9821017296",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 21290,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Yalda Yousoufi",
    "employeePhoneRaw": "9911484498",
    "employeePhone": "9911484498",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14032,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Sharifa Haqbin",
    "employeePhoneRaw": "8287753169",
    "employeePhone": "8287753169",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14516,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Bhumi Shresth",
    "employeePhoneRaw": "8920560350",
    "employeePhone": "8920560350",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14000,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Ibrahim",
    "employeePhoneRaw": "8368892176",
    "employeePhone": "8368892176",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 18710,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Khuwish",
    "employeePhoneRaw": "9891176694",
    "employeePhone": "9891176694",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9677,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Sonali Kumari",
    "employeePhoneRaw": "9304113956",
    "employeePhone": "9304113956",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 10645,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Mukund Kumar",
    "employeePhoneRaw": "9264273988",
    "employeePhone": "9264273988",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 16839,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "Yogesh",
    "employeePhoneRaw": "9716112267",
    "employeePhone": "9716112267",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 11613,
    "branchTag": "GD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[GD] July 2026 salary"
  },
  {
    "employeeName": "SOYAL",
    "employeePhoneRaw": "9650233754",
    "employeePhone": "9650233754",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 8774,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "RAMSHA",
    "employeePhoneRaw": "8595907221",
    "employeePhone": "8595907221",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 8900,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "RAJIV SINGH",
    "employeePhoneRaw": "9369343001",
    "employeePhone": "9369343001",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14758,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "PAWAN SHARMA",
    "employeePhoneRaw": "7390975405",
    "employeePhone": "7390975405",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 34400,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "RAJIV KUMAR SINGH",
    "employeePhoneRaw": "9643075865",
    "employeePhone": "9643075865",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12032,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "Adarsh Mathur",
    "employeePhoneRaw": "7557291195",
    "employeePhone": "7557291195",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13000,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "Dr Pranendra Singh",
    "employeePhoneRaw": "8923964333",
    "employeePhone": "8923964333",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 130000,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "Yakshi",
    "employeePhoneRaw": "7065776394",
    "employeePhone": "7065776394",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 11290,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "Jasleen Kaur",
    "employeePhoneRaw": "8076099390",
    "employeePhone": "8076099390",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 14758,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "Purnima Singh",
    "employeePhoneRaw": "8700103928",
    "employeePhone": "8700103928",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 4968,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "Ravina Adhikari",
    "employeePhoneRaw": "9319781023",
    "employeePhone": "9319781023",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 16726,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "Manmeet Kaur",
    "employeePhoneRaw": "8076668999",
    "employeePhone": "8076668999",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 18000,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "Aditya Maurya",
    "employeePhoneRaw": "9711581421",
    "employeePhone": "9711581421",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 25000,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "Arjun",
    "employeePhoneRaw": "9311636824",
    "employeePhone": "9311636824",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13000,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "Jyoti",
    "employeePhoneRaw": "8572025304",
    "employeePhone": "8572025304",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12000,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "Aditi (Inactive)",
    "employeePhoneRaw": "8168849419",
    "employeePhone": "8168849419",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12419,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "Vineeta",
    "employeePhoneRaw": "7011313765",
    "employeePhone": "7011313765",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 10016,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "Balaji Kumar",
    "employeePhoneRaw": "9650084920",
    "employeePhone": "9650084920",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 2323,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "Pardis Nazari",
    "employeePhoneRaw": "8586043260",
    "employeePhone": "8586043260",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 17000,
    "branchTag": "CD",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[CD] July 2026 salary"
  },
  {
    "employeeName": "Anjali",
    "employeePhoneRaw": "8512096063",
    "employeePhone": "8512096063",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15000,
    "branchTag": "Noida",
    "branch": "Noida",
    "dueDate": "2026-07-31",
    "remarks": "[Noida] July 2026 salary"
  },
  {
    "employeeName": "Shagufi",
    "employeePhoneRaw": "7827448876",
    "employeePhone": "7827448876",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 20000,
    "branchTag": "Noida",
    "branch": "Noida",
    "dueDate": "2026-07-31",
    "remarks": "[Noida] July 2026 salary"
  },
  {
    "employeeName": "Vaishnavi Yadav",
    "employeePhoneRaw": "7037219200",
    "employeePhone": "7037219200",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 8000,
    "branchTag": "Noida",
    "branch": "Noida",
    "dueDate": "2026-07-31",
    "remarks": "[Noida] July 2026 salary"
  },
  {
    "employeeName": "Yuvraj",
    "employeePhoneRaw": "9958741075",
    "employeePhone": "9958741075",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 32000,
    "branchTag": "Noida",
    "branch": "Noida",
    "dueDate": "2026-07-31",
    "remarks": "[Noida] July 2026 salary"
  },
  {
    "employeeName": "Rishabh Sonker",
    "employeePhoneRaw": "7054049997",
    "employeePhone": "7054049997",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15000,
    "branchTag": "Noida",
    "branch": "Noida",
    "dueDate": "2026-07-31",
    "remarks": "[Noida] July 2026 salary"
  },
  {
    "employeeName": "Dr Ishika Jain",
    "employeePhoneRaw": "9953625180",
    "employeePhone": "9953625180",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 25000,
    "branchTag": "Noida",
    "branch": "Noida",
    "dueDate": "2026-07-31",
    "remarks": "[Noida] July 2026 salary"
  },
  {
    "employeeName": "ANKUR",
    "employeePhoneRaw": "8527596280",
    "employeePhone": "8527596280",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13548,
    "branchTag": "HYD",
    "branch": "Hyderabad",
    "dueDate": "2026-07-31",
    "remarks": "[HYD] July 2026 salary"
  },
  {
    "employeeName": "NARENDER",
    "employeePhoneRaw": "8851212224",
    "employeePhone": "8851212224",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 85000,
    "branchTag": "HYD",
    "branch": "Hyderabad",
    "dueDate": "2026-07-31",
    "remarks": "[HYD] July 2026 salary"
  },
  {
    "employeeName": "pushpa",
    "employeePhoneRaw": "8766230317",
    "employeePhone": "8766230317",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 18065,
    "branchTag": "HYD",
    "branch": "Hyderabad",
    "dueDate": "2026-07-31",
    "remarks": "[HYD] July 2026 salary"
  },
  {
    "employeeName": "Sneha",
    "employeePhoneRaw": "7207351628",
    "employeePhone": "7207351628",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 13548,
    "branchTag": "HYD",
    "branch": "Hyderabad",
    "dueDate": "2026-07-31",
    "remarks": "[HYD] July 2026 salary"
  },
  {
    "employeeName": "Mamatha Chawan",
    "employeePhoneRaw": "9989497410",
    "employeePhone": "9989497410",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 22000,
    "branchTag": "HYD",
    "branch": "Hyderabad",
    "dueDate": "2026-07-31",
    "remarks": "[HYD] July 2026 salary"
  },
  {
    "employeeName": "Rajina Tamang",
    "employeePhoneRaw": "9593892598",
    "employeePhone": "9593892598",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15000,
    "branchTag": "HYD",
    "branch": "Hyderabad",
    "dueDate": "2026-07-31",
    "remarks": "[HYD] July 2026 salary"
  },
  {
    "employeeName": "Preeti gyadi",
    "employeePhoneRaw": "8787832352",
    "employeePhone": "8787832352",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15500,
    "branchTag": "HYD",
    "branch": "Hyderabad",
    "dueDate": "2026-07-31",
    "remarks": "[HYD] July 2026 salary"
  },
  {
    "employeeName": "KISHMI",
    "employeePhoneRaw": "8730812312",
    "employeePhone": "8730812312",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 15250,
    "branchTag": "HYD",
    "branch": "Hyderabad",
    "dueDate": "2026-07-31",
    "remarks": "[HYD] July 2026 salary"
  },
  {
    "employeeName": "AJAY BHATIYA",
    "employeePhoneRaw": "9211913109",
    "employeePhone": "9211913109",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 12000,
    "branchTag": "HYD",
    "branch": "Hyderabad",
    "dueDate": "2026-07-31",
    "remarks": "[HYD] July 2026 salary"
  },
  {
    "employeeName": "Ravi",
    "employeePhoneRaw": "9211247764",
    "employeePhone": "9211247764",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 3871,
    "branchTag": "HYD",
    "branch": "Hyderabad",
    "dueDate": "2026-07-31",
    "remarks": "[HYD] July 2026 salary"
  },
  {
    "employeeName": "Preeti Ajney",
    "employeePhoneRaw": "7780498940",
    "employeePhone": "7780498940",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 18000,
    "branchTag": "HYD",
    "branch": "Hyderabad",
    "dueDate": "2026-07-31",
    "remarks": "[HYD] July 2026 salary"
  },
  {
    "employeeName": "Rohit Verma",
    "employeePhoneRaw": "8764763600",
    "employeePhone": "8764763600",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 30000,
    "branchTag": "HYD",
    "branch": "Hyderabad",
    "dueDate": "2026-07-31",
    "remarks": "[HYD] July 2026 salary"
  },
  {
    "employeeName": "Madan",
    "employeePhoneRaw": "9588835502",
    "employeePhone": "9588835502",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 8903,
    "branchTag": "HYD",
    "branch": "Hyderabad",
    "dueDate": "2026-07-31",
    "remarks": "[HYD] July 2026 salary"
  },
  {
    "employeeName": "Dayashankar",
    "employeePhoneRaw": "6395614128",
    "employeePhone": "6395614128",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 2903,
    "branchTag": "HYD",
    "branch": "Hyderabad",
    "dueDate": "2026-07-31",
    "remarks": "[HYD] July 2026 salary"
  },
  {
    "employeeName": "Shejad",
    "employeePhoneRaw": "Not found",
    "employeePhone": null,
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 17500,
    "branchTag": "HYD",
    "branch": "Hyderabad",
    "dueDate": "2026-07-31",
    "remarks": "[HYD] July 2026 salary"
  },
  {
    "employeeName": "karan",
    "employeePhoneRaw": "8178939088",
    "employeePhone": "8178939088",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 9000,
    "branchTag": "Del",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Del] July 2026 salary"
  },
  {
    "employeeName": "Anita",
    "employeePhoneRaw": "8976192344",
    "employeePhone": "8976192344",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 6500,
    "branchTag": "Del",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Del] July 2026 salary"
  },
  {
    "employeeName": "Tanish",
    "employeePhoneRaw": "Not found",
    "employeePhone": null,
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 1200,
    "branchTag": "Del",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Del] July 2026 salary"
  },
  {
    "employeeName": "Monika",
    "employeePhoneRaw": "8700475374",
    "employeePhone": "8700475374",
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 30000,
    "branchTag": "Del",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Del] July 2026 salary"
  },
  {
    "employeeName": "Naveen",
    "employeePhoneRaw": "Not found",
    "employeePhone": null,
    "period": {
      "month": 7,
      "year": 2026
    },
    "amount": 5600,
    "branchTag": "Del",
    "branch": "Delhi",
    "dueDate": "2026-07-31",
    "remarks": "[Del] July 2026 salary"
  }
];

// --- args ------------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const CONFIRM_NAME_MATCHES = args.includes("--confirm-name-matches");
const DUMP_JSON = args.includes("--dump-json");

const inr = (n) => "Rs " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const IMPORT_IDENTITY = { name: "Bulk Import", email: "import@system", branch: "" };

if (DUMP_JSON) {
  const out = "salary-payables-payload.json";
  fs.writeFileSync(out, JSON.stringify(SALARY_ROWS, null, 2));
  console.log(`Wrote ${out} — ${SALARY_ROWS.length} row(s).`);
  process.exit(0);
}

if (!MONGODB_URI) {
  console.error("MONGODB_URI missing — checked .env.local and .env.");
  process.exit(1);
}

function normWords(name) {
  return (name || "").toUpperCase().replace(/[^A-Z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}
function nameSimilarity(a, b) {
  const wa = new Set(normWords(a));
  const wb = new Set(normWords(b));
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size);
}
const normExact = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
// Same rule scripts/employees-bulk-update.mjs settled on after "Nishi Afterservice" / "Ritu
// Afterservice" proved a plain overlap ratio isn't reliable at the boundary: safe only when the
// first word (the actual given name) matches, or overall overlap clears a much higher 75% bar.
function isSafeNameMatch(a, b) {
  const wa = normWords(a);
  const wb = normWords(b);
  if (wa[0] && wb[0] && wa[0] === wb[0]) return true;
  return nameSimilarity(a, b) >= 0.75;
}

function validate() {
  const errors = [];
  for (const r of SALARY_ROWS) {
    if (!(r.amount > 0)) errors.push(`${r.employeeName}: amount must be > 0`);
    if (!r.branch) errors.push(`${r.employeeName}: unmapped branch tag "${r.branchTag}"`);
    if (isNaN(new Date(r.dueDate).getTime())) errors.push(`${r.employeeName}: bad due date "${r.dueDate}"`);
  }
  return errors;
}

async function run() {
  console.log("=".repeat(90));
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  console.log(`Rows: ${SALARY_ROWS.length}  (source: emp_2.txt, July 2026)`);
  console.log("=".repeat(90) + "\n");

  const errors = validate();
  if (errors.length) {
    console.error(`VALIDATION FAILED — ${errors.length} problem(s). Nothing imported.\n`);
    errors.forEach((e) => console.error("  " + e));
    process.exit(1);
  }
  console.log("Validation passed.\n");

  const total = SALARY_ROWS.reduce((s, r) => s + r.amount, 0);
  console.log(`Total salary across all rows: ${inr(total)}\n`);

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const Employee = mongoose.models.Employee || mongoose.model("Employee", new mongoose.Schema({}, { strict: false, collection: "employees" }));
  const Payable = mongoose.models.Payable || mongoose.model("Payable", new mongoose.Schema({}, { strict: false, collection: "payables" }));

  // ---------------------------------------------------------------------------
  // PASS 1 — resolve every row's employee and classify it. No writes.
  // ---------------------------------------------------------------------------
  console.log("Resolving employees and checking for existing payables...\n");
  const resolved = [];

  for (const r of SALARY_ROWS) {
    let employee = null;
    let matchedBy = null;
    let ambiguous = null; // set when phone or name collides across more than one real employee

    if (r.employeePhone) {
      const byPhone = await Employee.find({ phone: r.employeePhone }).select("_id name phone").lean();
      if (byPhone.length === 1) {
        employee = byPhone[0];
        matchedBy = "phone";
      } else if (byPhone.length > 1) {
        // The Employee model has no unique index on phone — two real people CAN share one.
        // Picking either arbitrarily risks paying the wrong person's salary against the wrong
        // employee record, so this is never auto-resolved.
        ambiguous = { reason: "phone", candidates: byPhone };
      }
    }

    if (!employee && !ambiguous) {
      // Name fallback — reached when the sheet had no usable phone, or the phone matched no
      // one. Matches on EXACT name (case/whitespace-insensitive), which is itself a strong
      // identity signal — but the same collision risk applies: two different real employees
      // can share one exact name (very plausible with 300+ staff and common first names).
      const byName = await Employee.find({ name: new RegExp(`^\\s*${r.employeeName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i") })
        .select("_id name phone")
        .lean();
      if (byName.length === 1) {
        employee = byName[0];
        matchedBy = "name";
      } else if (byName.length > 1) {
        ambiguous = { reason: "name", candidates: byName };
      }
    }

    if (ambiguous) {
      resolved.push({ r, status: "ambiguous", ambiguous });
      continue;
    }
    if (!employee) {
      resolved.push({ r, status: "not-found" });
      continue;
    }

    // An EXACT name match (matchedBy === "name", or a phone match whose stored name is
    // identical up to case/whitespace) is a stronger signal than the word-overlap heuristic —
    // trust it outright. Only a phone match against a NON-exact, merely word-overlapping name
    // needs the coarser isSafeNameMatch check, and anything short of that is held for review.
    const exact = normExact(r.employeeName) === normExact(employee.name);
    const safe = exact || (matchedBy === "phone" && isSafeNameMatch(r.employeeName, employee.name));
    if (!safe) {
      resolved.push({ r, status: "needs-confirm", employee, matchedBy, similarity: nameSimilarity(r.employeeName, employee.name) });
      continue;
    }

    const existingPayable = await Payable.findOne({
      "payee.kind": "EMPLOYEE",
      "payee.refId": employee._id,
      purpose: "SALARY",
      "period.month": r.period.month,
      "period.year": r.period.year,
    }).select("_id totalAmount").lean();

    if (existingPayable) {
      resolved.push({ r, status: "already-exists", employee, existingId: String(existingPayable._id), existingAmount: existingPayable.totalAmount });
      continue;
    }

    resolved.push({ r, status: "ok", employee });
  }

  const ok = resolved.filter((x) => x.status === "ok");
  const needsConfirm = resolved.filter((x) => x.status === "needs-confirm");
  const notFound = resolved.filter((x) => x.status === "not-found");
  const alreadyExists = resolved.filter((x) => x.status === "already-exists");
  const ambiguousRows = resolved.filter((x) => x.status === "ambiguous");

  console.log(`  OK to create              : ${ok.length}`);
  console.log(`  Needs confirmation (name)  : ${needsConfirm.length}  (needs --confirm-name-matches)`);
  console.log(`  Ambiguous (multiple match) : ${ambiguousRows.length}  (never auto-resolved)`);
  console.log(`  Employee not found         : ${notFound.length}`);
  console.log(`  Payable already exists     : ${alreadyExists.length}`);

  if (ambiguousRows.length) {
    console.log("\n--- AMBIGUOUS — more than one employee matched, cannot safely pick one (skipped) ---");
    ambiguousRows.forEach(({ r, ambiguous }) => {
      console.log(`  "${r.employeeName}" (${r.employeePhoneRaw})  ${inr(r.amount)}  — ${ambiguous.candidates.length} employees share this ${ambiguous.reason}:`);
      ambiguous.candidates.forEach((c) => console.log(`      ${c._id}  "${c.name}"  (${c.phone})`));
    });
    console.log("These need manual resolution — pick the right _id and update the source data, or handle directly.");
  }

  if (notFound.length) {
    console.log("\n--- EMPLOYEE NOT FOUND (skipped) ---");
    notFound.forEach(({ r }) => console.log(`  ${r.employeeName}  (${r.employeePhoneRaw})  ${inr(r.amount)}`));
    console.log("Run scripts/employees-bulk-import.mjs / employees-bulk-update.mjs first if these are missing.");
  }

  if (alreadyExists.length) {
    console.log("\n--- PAYABLE ALREADY EXISTS (skipped) ---");
    alreadyExists.forEach(({ r, employee, existingId, existingAmount }) =>
      console.log(`  ${employee.name}  -> ${existingId} (${inr(existingAmount)})${existingAmount !== r.amount ? `  <-- sheet says ${inr(r.amount)}, different!` : ""}`),
    );
  }

  if (needsConfirm.length) {
    console.log("\n" + "!".repeat(90));
    console.log("NEEDS CONFIRMATION — matched by name only, or phone matched a dissimilar stored name.");
    console.log("Not created unless you pass --confirm-name-matches. Review carefully:");
    console.log("!".repeat(90));
    needsConfirm.forEach(({ r, employee, matchedBy, similarity }) =>
      console.log(`  "${r.employeeName}" (${r.employeePhoneRaw})  ->  existing "${employee.name}" (${employee._id})  matched by ${matchedBy}, similarity ${(similarity * 100).toFixed(0)}%  ${inr(r.amount)}`),
    );
    console.log("");
  }

  if (needsConfirm.length && APPLY && !CONFIRM_NAME_MATCHES) {
    console.error("Refusing to create the name-matched rows above without --confirm-name-matches.");
    console.error("The clean phone-matched rows below are unaffected and will still proceed.\n");
  }

  if (!ok.length && !(needsConfirm.length && CONFIRM_NAME_MATCHES)) {
    console.log("\nNothing eligible to create.");
    await mongoose.disconnect();
    return;
  }

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply once the lists above look right.");
    await mongoose.disconnect();
    return;
  }

  console.log(`\nCreating ${ok.length} salary payable(s)...`);
  const created = [];
  const failed = [];

  async function createOne(r, employee) {
    const doc = await Payable.create({
      payee: { kind: "EMPLOYEE", refId: employee._id, label: employee.name },
      purpose: "SALARY",
      expenseCategory: "Salary",
      expenseSubType: "Salary",
      period: { month: r.period.month, year: r.period.year },
      totalAmount: r.amount,
      dueDate: new Date(r.dueDate),
      branch: r.branch,
      remarks: r.remarks,
      isCancelled: false,
      costAlreadyRecognised: false,
      createdBy: { ...IMPORT_IDENTITY, branch: r.branch, date: new Date() },
      log: [
        {
          action: "Created",
          newValue: String(r.amount),
          note: `Bulk import from emp_2.txt (source location tag: ${r.branchTag})`,
          performedBy: IMPORT_IDENTITY,
          performedAt: new Date(),
        },
      ],
    });
    return doc;
  }

  for (const { r, employee } of ok) {
    try {
      const doc = await createOne(r, employee);
      created.push({ name: employee.name, id: String(doc._id), amount: r.amount });
      console.log(`  ${employee.name.padEnd(30)} ${inr(r.amount).padStart(12)}  OK  -> ${doc._id}`);
    } catch (err) {
      const reason = err?.code === 11000 ? "duplicate — a SALARY payable already exists for this employee this month" : err?.message || String(err);
      failed.push({ name: employee.name, reason });
      console.log(`  ${employee.name.padEnd(30)}  FAILED: ${reason}`);
    }
  }

  if (needsConfirm.length && CONFIRM_NAME_MATCHES) {
    console.log("\n--confirm-name-matches passed — creating the name-matched rows too...");
    for (const { r, employee } of needsConfirm) {
      try {
        const existingPayable = await Payable.findOne({
          "payee.kind": "EMPLOYEE", "payee.refId": employee._id, purpose: "SALARY",
          "period.month": r.period.month, "period.year": r.period.year,
        }).select("_id").lean();
        if (existingPayable) {
          console.log(`  ${employee.name}  — payable already exists (${existingPayable._id}), skipped`);
          continue;
        }
        const doc = await createOne(r, employee);
        created.push({ name: employee.name, id: String(doc._id), amount: r.amount });
        console.log(`  ${employee.name.padEnd(30)} ${inr(r.amount).padStart(12)}  OK  -> ${doc._id}  (NAME MATCH, CONFIRMED)`);
      } catch (err) {
        const reason = err?.code === 11000 ? "duplicate" : err?.message || String(err);
        failed.push({ name: employee.name, reason });
        console.log(`  ${employee.name.padEnd(30)}  FAILED: ${reason}`);
      }
    }
  }

  console.log(`\nCreated ${created.length} payable(s)` + (failed.length ? `, ${failed.length} failed` : "") + ".");

  const reportPath = `salary-payables-import-report-${Date.now()}.json`;
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        created,
        failed,
        skippedNotFound: notFound.map(({ r }) => ({ name: r.employeeName, phone: r.employeePhoneRaw, amount: r.amount })),
        skippedAmbiguous: ambiguousRows.map(({ r, ambiguous }) => ({ name: r.employeeName, phone: r.employeePhoneRaw, amount: r.amount, reason: ambiguous.reason, candidateIds: ambiguous.candidates.map((c) => String(c._id)) })),
        skippedAlreadyExists: alreadyExists.map(({ r, existingId }) => ({ name: r.employeeName, existingId, amount: r.amount })),
        skippedNeedsConfirm: CONFIRM_NAME_MATCHES ? [] : needsConfirm.map(({ r, employee }) => ({ name: r.employeeName, existingName: employee.name, existingId: String(employee._id), amount: r.amount })),
      },
      null,
      2,
    ),
  );
  console.log(`\nReport written to ${reportPath} — keep it, the IDs are your undo list.`);

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
