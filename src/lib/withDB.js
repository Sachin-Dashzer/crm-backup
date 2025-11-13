
import dbConnect from "./db";
import { NextResponse } from "next/server";

export function withDB(handler) {
  return async (req) => {
    try {
      await dbConnect(); // Ensure database connection
      return await handler(req);
    } catch (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { message: 'Database connection failed' },
        { status: 500 }
      );
    }
  };
}