import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import mongoose from "mongoose";
import Receivable from "@/models/Receivable";
import Transactions from "@/models/Transactions";
import { buildReceivableAggregationStages } from "@/lib/receivableAggregation";

const ALLOWED_ROLES = ["admin", "super-admin"];

// Single-receivable read, computed the exact same way the list/summary routes are — see
// buildReceivableAggregationStages. Used by the transaction detail view to show "current
// pending" on a linked receivable without duplicating the aggregation.
export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid receivable ID" }, { status: 400 });
    }

    const [receivable] = await Receivable.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      ...buildReceivableAggregationStages(Transactions.collection.name),
    ]);
    if (!receivable) {
      return NextResponse.json({ error: "Receivable not found" }, { status: 404 });
    }

    return NextResponse.json({ receivable });
  } catch (error) {
    console.error("Error fetching receivable:", error);
    return NextResponse.json({ error: "Failed to fetch receivable" }, { status: 500 });
  }
}

// Revises totalAmount / dueDate, or cancels a Receivable (soft-close via
// isCancelled — never hard-deleted). Every change appends to log[]; existing
// log entries are never edited or removed.
export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;
    const { totalAmount, dueDate, isCancelled, note } = await req.json();

    const receivable = await Receivable.findById(id);
    if (!receivable) {
      return NextResponse.json({ error: "Receivable not found" }, { status: 404 });
    }

    const performedBy = { name: session.user.name, email: session.user.email };

    if (totalAmount != null && parseFloat(totalAmount) !== receivable.totalAmount) {
      receivable.log.push({
        action: "Amount Revised",
        previousValue: String(receivable.totalAmount),
        newValue: String(parseFloat(totalAmount)),
        note,
        performedBy,
        performedAt: new Date(),
      });
      receivable.totalAmount = parseFloat(totalAmount);
    }

    if (dueDate !== undefined) {
      const newDue = dueDate ? new Date(dueDate) : null;
      const prevDue = receivable.dueDate ? receivable.dueDate.toISOString() : null;
      const nextDue = newDue ? newDue.toISOString() : null;
      if (prevDue !== nextDue) {
        receivable.log.push({
          action: "Due Date Changed",
          previousValue: prevDue || "none",
          newValue: nextDue || "none",
          note,
          performedBy,
          performedAt: new Date(),
        });
        receivable.dueDate = newDue;
      }
    }

    if (isCancelled === true && !receivable.isCancelled) {
      receivable.isCancelled = true;
      receivable.log.push({
        action: "Cancelled",
        previousValue: "false",
        newValue: "true",
        note,
        performedBy,
        performedAt: new Date(),
      });
    } else if (isCancelled === false && receivable.isCancelled) {
      receivable.isCancelled = false;
      receivable.log.push({
        action: "Cancelled",
        previousValue: "true",
        newValue: "false",
        note: note || "Reinstated",
        performedBy,
        performedAt: new Date(),
      });
    }

    if (note && totalAmount == null && dueDate === undefined && isCancelled === undefined) {
      receivable.log.push({
        action: "Note Added",
        note,
        performedBy,
        performedAt: new Date(),
      });
    }

    await receivable.save();

    return NextResponse.json({ message: "Receivable updated", receivable });
  } catch (error) {
    console.error("Error updating receivable:", error);
    return NextResponse.json({ error: "Failed to update receivable" }, { status: 500 });
  }
}
