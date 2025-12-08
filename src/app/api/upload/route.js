// app/api/upload/route.js
import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Increase timeout - this is important for large files
export const maxDuration = 300; // 5 minutes
export const dynamic = "force-dynamic";

// Named export for POST method
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

    // Check file size (e.g., 10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: `File size exceeds 10MB limit. Current size: ${(
            file.size /
            1024 /
            1024
          ).toFixed(2)}MB`,
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine resource type
    const isPDF = file.name.toLowerCase().endsWith(".pdf");
    const resourceType = isPDF ? "raw" : "image";

    // Upload with optimized settings and timeout
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `ryan-clinic/${patientId}/${section}`,
          resource_type: resourceType,
          timeout: 120000, // 2 minute timeout per upload
          // For images, add optimization
          ...(resourceType === "image" && {
            quality: "auto:good",
            fetch_format: "auto",
          }),
          // For PDFs, ensure they're viewable
          ...(isPDF && {
            flags: "attachment:false",
          }),
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      uploadStream.end(buffer);
    });

    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Upload timeout after 2 minutes")),
        120000
      );
    });

    const result = await Promise.race([uploadPromise, timeoutPromise]);

    // For PDFs, modify URL to ensure inline viewing
    let filePath = result.secure_url;
    if (isPDF) {
      filePath = filePath.replace("/upload/", "/upload/fl_attachment:false/");
    }

    return NextResponse.json({
      success: true,
      filePath: filePath,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error("Upload API error:", error);

    // Provide specific error messages
    let errorMessage = "Failed to upload file";

    if (error.message?.includes("timeout")) {
      errorMessage =
        "Upload timeout - file may be too large or network is slow";
    } else if (error.http_code === 502) {
      errorMessage =
        "Cloudinary service temporarily unavailable. Please try again.";
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// Named export for DELETE method
export async function DELETE(request) {
  try {
    const { publicId, resourceType } = await request.json();

    if (!publicId) {
      return NextResponse.json(
        { success: false, message: "No public ID provided" },
        { status: 400 }
      );
    }

    console.log("Attempting to delete from Cloudinary:", {
      publicId,
      resourceType,
    });

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType || "image",
      timeout: 60000, // 1 minute timeout
      invalidate: true, // Invalidate CDN cache
    });

    console.log("Cloudinary delete result:", result);

    // Cloudinary returns result: 'ok' for successful deletion
    // result: 'not found' if file doesn't exist
    const isSuccess = result.result === "ok";
    const isNotFound = result.result === "not found";

    if (isSuccess) {
      return NextResponse.json({
        success: true,
        message: "File deleted successfully",
      });
    } else if (isNotFound) {
      // File not found is OK - it's already deleted
      return NextResponse.json({
        success: true,
        message: "File not found",
        alreadyDeleted: true,
      });
    } else {
      return NextResponse.json({
        success: false,
        message: `Unexpected result: ${result.result}`,
      });
    }
  } catch (error) {
    console.error("Delete API error:", error);

    // Check if it's a "not found" error
    if (error.message && error.message.includes("not found")) {
      return NextResponse.json({
        success: true,
        message: "File not found",
        alreadyDeleted: true,
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete file",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
