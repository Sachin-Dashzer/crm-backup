
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { withDB } from "@/lib/withDB";



const handler = async(req) =>{

  try {
    await dbConnect();
    return NextResponse.json({ message: "Logout successful" }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: "Logout failed" },
      { status: 500 }
    );
  }
}


export const GET = withDB(handler);