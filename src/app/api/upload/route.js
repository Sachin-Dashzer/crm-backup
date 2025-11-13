import { writeFile, unlink, mkdir } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import { existsSync } from "fs";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const section = formData.get("section");
    const patientId = formData.get("patientId");

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file provided" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create directory structure: public/uploads/{patientId}/{section}
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      patientId,
      section
    );

    // Create directory if it doesn't exist
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name.replace(/\s+/g, "_"); // Replace spaces with underscores
    const filename = `${timestamp}_${originalName}`;
    const filepath = path.join(uploadDir, filename);

    // Write file to disk
    await writeFile(filepath, buffer);

    // Return the relative path that will be stored in database
    const relativePath = `/uploads/${patientId}/${section}/${filename}`;

    return NextResponse.json({
      success: true,
      message: "File uploaded successfully",
      filePath: relativePath,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { success: false, message: "Failed to upload file" },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { filePath } = await request.json();

    if (!filePath) {
      return NextResponse.json(
        { success: false, message: "No file path provided" },
        { status: 400 }
      );
    }

    // Convert relative path to absolute path
    const absolutePath = path.join(process.cwd(), "public", filePath);

    // Check if file exists
    if (existsSync(absolutePath)) {
      await unlink(absolutePath);
      return NextResponse.json({
        success: true,
        message: "File deleted successfully",
      });
    } else {
      return NextResponse.json(
        { success: false, message: "File not found" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete file" },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};