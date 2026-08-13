import imageCompression from "browser-image-compression";

// Client-side upload prep — every upload entry point routes through prepareFileForUpload()
// before building FormData, so nothing ever sends a 5MB phone photo to /api/upload just to
// have it read into a Buffer server-side. See ReceiptUpload.jsx and the patient DocumentUpload
// components.

const TARGET_BYTES = 1024 * 1024; // 1MB
const MAX_DIMENSION = 1920;
const START_QUALITY = 0.8;
const MIN_QUALITY = 0.5; // floor — a receipt whose figures can't be read is worse than a 1.2MB file
const QUALITY_STEP = 0.1;

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Resizes to at most MAX_DIMENSION on the long edge and iteratively steps quality down from
// START_QUALITY to MIN_QUALITY until under TARGET_BYTES (or the floor is hit — whichever comes
// first). Each attempt re-compresses the ORIGINAL file rather than the previous attempt's
// output, so quality loss doesn't compound across iterations.
//
// browser-image-compression auto-detects and corrects EXIF orientation by physically rotating
// the pixels during the canvas resize (this is default behavior, not an option to set) — the
// output simply has no orientation tag left to lose, which is more robust than "preserving" one
// that half of image viewers ignore anyway.
export async function compressImage(file) {
  const originalSize = file.size;

  if (!file.type?.startsWith("image/")) {
    return { file, wasCompressed: false, originalSize, compressedSize: originalSize };
  }

  if (originalSize <= TARGET_BYTES) {
    return { file, wasCompressed: false, originalSize, compressedSize: originalSize };
  }

  let quality = START_QUALITY;
  let result = file;
  try {
    while (true) {
      result = await imageCompression(file, {
        maxWidthOrHeight: MAX_DIMENSION,
        initialQuality: quality,
        useWebWorker: true,
      });
      if (result.size <= TARGET_BYTES || quality <= MIN_QUALITY) break;
      quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
    }
  } catch (error) {
    console.error("Image compression failed, uploading original:", error);
    return { file, wasCompressed: false, originalSize, compressedSize: originalSize, error: true };
  }

  return {
    file: result,
    wasCompressed: true,
    originalSize,
    compressedSize: result.size,
  };
}

// Single entry point for any upload call site, regardless of file type:
// - images: compressed via compressImage()
// - PDFs: never compressed client-side (unreliable) — oversized ones get a `warning` string but
//   still upload; the server's existing 10MB check is the real backstop
// - anything else (doc/docx consent forms etc.): passed through untouched
export async function prepareFileForUpload(file) {
  if (!file) {
    return { file, wasCompressed: false, warning: null, originalSize: 0, compressedSize: 0 };
  }

  if (file.type === "application/pdf") {
    const oversized = file.size > TARGET_BYTES;
    return {
      file,
      wasCompressed: false,
      warning: oversized
        ? `This PDF is ${formatBytes(file.size)} — larger than ideal, but it will still upload.`
        : null,
      originalSize: file.size,
      compressedSize: file.size,
    };
  }

  if (file.type?.startsWith("image/")) {
    const result = await compressImage(file);
    return { ...result, warning: null };
  }

  return { file, wasCompressed: false, warning: null, originalSize: file.size, compressedSize: file.size };
}
