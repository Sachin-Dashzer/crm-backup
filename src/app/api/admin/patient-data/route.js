import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Employee from "@/models/Employee";
import Transactions from "@/models/Transactions.js";

const handler = async (req) => {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { 
                    success: false, 
                    error: "Patient ID is required" 
                },
                { status: 400 }
            );
        }

        const patient = await Patient.findById(id)
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
                path: 'surgery.seniorTech',
                select: 'name',
                model: 'Employee'
            })
            .populate({
                path: 'surgery.implanterRight',
                select: 'name',
                model: 'Employee'
            })
            .populate({
                path: 'surgery.implanterLeft',
                select: 'name',
                model: 'Employee'
            })
            .populate({
                path: 'surgery.graftingPerson',
                select: 'name',
                model: 'Employee'
            })
            .populate({
                path: 'surgery.helper',
                select: 'name',
                model: 'Employee'
            })              
            .populate({
                path: 'payments.transactions',
                select: 'date branch paymentType method amount',
                model: 'Transactions'
            });

        if (!patient) {
            return NextResponse.json(
                { 
                    success: false, 
                    error: "Patient not found" 
                },
                { status: 404 }
            );
        }

        return NextResponse.json({ 
            patient, 
            success: true,
        }, { status: 200 });

    } catch (error) {
        console.error("Error fetching patient data:", error);
        return NextResponse.json(
            { 
                success: false, 
                error: "Failed to fetch patient data" 
            },
            { status: 500 }
        );
    }
}

export const GET = withDB(handler);