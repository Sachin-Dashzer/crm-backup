import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Stock from "@/models/Stock";
import Vendor from "@/models/Vender";
import Patient from "@/models/Patient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function PUT(req) {
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
    const {
      id,
      name,
      purchase,
      sell,
      gstNo,
      weight,
      unit,
      mrp,
      expiry,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Stock ID is required" },
        { status: 400 }
      );
    }

    // Find existing stock
    const existingStock = await Stock.findById(id);
    if (!existingStock) {
      return NextResponse.json(
        { success: false, message: "Stock not found" },
        { status: 404 }
      );
    }

    // Validate vendors if purchase data is updated
    if (purchase && purchase.length > 0) {
      for (const purchaseItem of purchase) {
        if (purchaseItem.vender) {
          const vendorExists = await Vendor.findById(purchaseItem.vender);
          if (!vendorExists) {
            return NextResponse.json(
              {
                success: false,
                message: `Vendor with ID ${purchaseItem.vender} not found`,
              },
              { status: 400 }
            );
          }
        }
      }
    }

    // Validate patients if sell data is updated
    if (sell && sell.length > 0) {
      for (const sellItem of sell) {
        if (sellItem.patient) {
          const patientExists = await Patient.findById(sellItem.patient);
          if (!patientExists) {
            return NextResponse.json(
              {
                success: false,
                message: `Patient with ID ${sellItem.patient} not found`,
              },
              { status: 400 }
            );
          }
        }
      }
    }

    // Calculate new total quantity
    let totalQuantity = 0;
    const purchaseData = purchase || existingStock.purchase;
    const sellData = sell || existingStock.sell;

    // Total purchased quantity
    const totalPurchased = purchaseData.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    );

    // Total sold quantity
    const totalSold = sellData.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    );

    // Remaining quantity
    totalQuantity = totalPurchased - totalSold;

    // Track field changes for audit
    const updatedFields = [];
    
    if (name && name !== existingStock.name) {
      updatedFields.push({
        name: "name",
        previousValue: existingStock.name || "",
        newValue: name,
      });
    }
    
    if (mrp && mrp !== existingStock.mrp) {
      updatedFields.push({
        name: "mrp",
        previousValue: existingStock.mrp?.toString() || "",
        newValue: mrp.toString(),
      });
    }
    
    if (purchase) {
      updatedFields.push({
        name: "purchase",
        previousValue: `${existingStock.purchase?.length || 0} entries`,
        newValue: `${purchase.length} entries`,
      });
    }
    
    if (sell) {
      updatedFields.push({
        name: "sell",
        previousValue: `${existingStock.sell?.length || 0} entries`,
        newValue: `${sell.length} entries`,
      });
    }

    // Prepare update data
    const updateData = {
      ...(name && { name }),
      ...(purchase && { purchase }),
      ...(sell && { sell }),
      ...(gstNo !== undefined && { gstNo }),
      ...(weight !== undefined && { weight }),
      ...(unit && { unit }),
      ...(mrp !== undefined && { mrp }),
      ...(expiry && { expiry }),
      totalQuantity,
    };

    // Add editor information
    const editorInfo = {
      name: session.user.name,
      email: session.user.email,
      branch: session.user.branch,
      date: new Date(),
      updatedFields,
    };

    // Update stock
    const stock = await Stock.findByIdAndUpdate(
      id,
      {
        ...updateData,
        $push: { editors: editorInfo },
      },
      { new: true, runValidators: true }
    )
      .populate("purchase.vender")
      .populate("sell.patient");

    return NextResponse.json(
      {
        success: true,
        message: "Stock updated successfully",
        data: stock,
        updatedFields: updatedFields.length,
        totalQuantity,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating stock:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to update stock",
        error: error.message,
      },
      { status: 500 }
    );
  }
}