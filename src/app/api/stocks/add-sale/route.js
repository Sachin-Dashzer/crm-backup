import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Stock from "@/models/Stock";
import Patient from "@/models/Patient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { stockId, price, discount, date, patient, quantity, otherPatient } =
      body;

    if (!stockId || !price || !quantity) {
      return NextResponse.json(
        {
          success: false,
          message: "Stock ID, price, and quantity are required",
        },
        { status: 400 }
      );
    }

    // Find stock
    const stock = await Stock.findById(stockId);
    if (!stock) {
      return NextResponse.json(
        { success: false, message: "Stock not found" },
        { status: 404 }
      );
    }

    // Check if enough stock is available
    if (stock.totalQuantity < quantity) {
      return NextResponse.json(
        {
          success: false,
          message: `Insufficient stock. Only ${stock.totalQuantity} units available`,
          availableQuantity: stock.totalQuantity,
        },
        { status: 400 }
      );
    }

    // Validate patient if provided
    if (patient) {
      const patientExists = await Patient.findById(patient);
      if (!patientExists) {
        return NextResponse.json(
          { success: false, message: "Patient not found" },
          { status: 404 }
        );
      }
    }

    // Validate otherPatient if no patient ID is provided
    if (!patient && (!otherPatient || !otherPatient.name)) {
      return NextResponse.json(
        {
          success: false,
          message: "Either patient ID or other patient details are required",
        },
        { status: 400 }
      );
    }

    // Add sale to stock
    const newSale = {
      price,
      discount: discount || 0,
      date: date || new Date(),
      patient,
      quantity,
      otherPatient,
    };

    stock.sell.push(newSale);

    // Recalculate total quantity
    const totalPurchased = stock.purchase.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    );
    const totalSold = stock.sell.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    );
    stock.totalQuantity = totalPurchased - totalSold;

    // Add editor info
    if (!stock.editors) {
      stock.editors = [];
    }
    stock.editors.push({
      name: session.user.name,
      email: session.user.email,
      branch: session.user.branch,
      date: new Date(),
      updatedFields: [
        {
          name: "sell",
          previousValue: `${stock.sell.length - 1} entries`,
          newValue: `${stock.sell.length} entries (sold ${quantity} units)`,
        },
      ],
    });

    await stock.save();

    // Populate and return
    const updatedStock = await Stock.findById(stockId)
      .populate("purchase.vender")
      .populate("sell.patient");

    return NextResponse.json(
      {
        success: true,
        message: "Sale recorded successfully",
        data: updatedStock,
        soldQuantity: quantity,
        newTotalQuantity: stock.totalQuantity,
        totalSaleAmount: price * quantity - (discount || 0),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error adding sale:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to record sale",
        error: error.message,
      },
      { status: 500 }
    );
  }
}