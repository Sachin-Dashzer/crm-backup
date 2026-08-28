import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const maxDuration = 300;
export const dynamic = "force-dynamic";

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

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
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

    const isPDF = file.name.toLowerCase().endsWith(".pdf");
    const resourceType = isPDF ? "raw" : "image";

    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: patientId
            ? `ryan-clinic/${patientId}/${section}`
            : `ryan-clinic/receipts/${section}`,
          resource_type: resourceType,
          timeout: 120000,
          ...(resourceType === "image" && {
            quality: "auto:good",
            fetch_format: "auto",
          }),
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

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Upload timeout after 2 minutes")),
        120000
      );
    });

    const result = await Promise.race([uploadPromise, timeoutPromise]);

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
      timeout: 60000,
      invalidate: true,
    });

    console.log("Cloudinary delete result:", result);

    const isSuccess = result.result === "ok";
    const isNotFound = result.result === "not found";

    if (isSuccess) {
      return NextResponse.json({
        success: true,
        message: "File deleted successfully",
      });
    } else if (isNotFound) {
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
