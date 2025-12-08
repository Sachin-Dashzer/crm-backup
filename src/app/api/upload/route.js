import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const isPDF = fileExtension === 'pdf';
    
    const resourceType = isPDF ? 'raw' : 'image';

    const uploadResponse = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: `patients/${patientId}/${section}`,
          resource_type: resourceType,
          public_id: `${Date.now()}_${file.name.replace(/\s+/g, "_").replace(/\.[^/.]+$/, "")}`,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    // Generate accessible URL without transformations
    let accessibleUrl = uploadResponse.secure_url;

    return NextResponse.json({
      success: true,
      message: "File uploaded successfully",
      filePath: accessibleUrl,
      publicId: uploadResponse.public_id,
      resourceType: uploadResponse.resource_type,
      format: uploadResponse.format,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { success: false, message: "Failed to upload file", error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { publicId, resourceType } = await request.json();

    if (!publicId) {
      return NextResponse.json(
        { success: false, message: "No public ID provided" },
        { status: 400 }
      );
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType || 'raw',
    });

    if (result.result === "ok") {
      return NextResponse.json({
        success: true,
        message: "File deleted successfully",
      });
    } else {
      const retryResult = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
      });
      
      if (retryResult.result === "ok") {
        return NextResponse.json({
          success: true,
          message: "File deleted successfully",
        });
      }
      
      return NextResponse.json(
        { success: false, message: "File not found or already deleted" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete file", error: error.message },
      { status: 500 }
    );
  }
}