import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Transactions from "@/models/Transactions";



const handler = async(req) =>{

    const transactions = await Transactions.find({}).populate({
        path: 'patient',
        select: 'personal.name personal.phone surgery.technique payments.totalAmount payments.amountReceived payments.pendingAmount payments.medicineAmount createdAt',
        options: { sort: { createdAt: -1 } }
      })
      .sort({ name: 1 });
;

    const finaldata = transactions.reduce((acc , transactions) =>{

        const type = transactions.costType || "other";

        if(!acc[type]){
            acc[type] = [];
        }

        acc[type].push({
            _id : transactions._id,
            patient : transactions.patient,
            branch : transactions.branch,
            procedure : transactions.procedure,
            expense : transactions.expense,
            method : transactions.method,
            amount : transactions.amount,
            date : transactions.date,
            remarks : transactions.remarks,
        })

        return acc;

    } , {});


    return NextResponse.json({
        success : true,
        data : finaldata,
        types : Object.keys(finaldata),
    })

}

export const GET = withDB(handler);