import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Employee from "@/models/Employee";
import Transactions from "@/models/Transactions";

const handler = async (req) => {
    try {
        // Fetch patients with only necessary fields for sales dashboard
        const patients = await Patient.find({})
            .select('personal ops counselling payments surgery.surgeryDate surgery.technique surgery.doctor createdAt updatedAt')
            .populate({
                path: 'personal.reference',
                select: 'name',
                model: 'Employee'
            })
            .populate({
                path: 'counselling.counsellor',
                select: 'name',
                model: 'Employee'
            })
            .populate({
                path: 'surgery.doctor',
                select: 'name',
                model: 'Employee'
            })
            .populate({
                path: 'payments.transactions',
                select: 'amount paymentMode date',
                model: 'Transactions'
            })
            .sort({ createdAt: -1 });

        // Calculate payment summaries
        const patientsWithSummary = patients.map(patient => {
            const totalAmount = patient.payments?.totalAmount || 0;
            const amountReceived = patient.payments?.amountReceived || 0;
            const pendingAmount = totalAmount - amountReceived;
            const paymentStatus = pendingAmount === 0 ? 'PAID' : pendingAmount === totalAmount ? 'UNPAID' : 'PARTIAL';

            return {
                ...patient.toObject(),
                payments: {
                    ...patient.payments?.toObject(),
                    pendingAmount,
                    paymentStatus
                }
            };
        });



        return NextResponse.json({ 
            patients: patientsWithSummary, 
            success: true,
            count: patientsWithSummary.length 
        }, { status: 200 });

    } catch (error) {
        console.error("Error fetching sales patients:", error);
        return NextResponse.json(
            { 
                success: false, 
                error: "Failed to fetch patients" 
            },
            { status: 500 }
        );
    }
}

export const GET = withDB(handler);