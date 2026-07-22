import path from "node:path";
import { env } from "@/lib/env";

const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".webm", ".mov", ".pdf", ".txt", ".csv", ".docx", ".pptx", ".xlsx"]);
const blockedMimeTypes = new Set(["text/html", "image/svg+xml", "application/javascript", "text/javascript", "application/x-msdownload", "application/x-sh", "application/x-powershell"]);

const canonicalMime: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".pdf": "application/pdf",
  ".txt": "text/plain", ".csv": "text/csv", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function canonicalUploadMime(name: string) {
  return canonicalMime[path.extname(name).toLowerCase()] || "application/octet-stream";
}

function imageDimensions(extension: string, bytes: Uint8Array) {
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (extension === ".png" && data.length >= 24) return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  if (extension === ".gif" && data.length >= 10) return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) };
  if (extension === ".jpg" || extension === ".jpeg") {
    let offset = 2;
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) { offset += 1; continue; }
      const marker = data[offset + 1];
      if (new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]).has(marker)) return { width: data.readUInt16BE(offset + 7), height: data.readUInt16BE(offset + 5) };
      if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
      const length = data.readUInt16BE(offset + 2);
      if (length < 2) break;
      offset += 2 + length;
    }
  }
  if (extension === ".webp" && data.length >= 30) {
    const kind = data.subarray(12, 16).toString("ascii");
    if (kind === "VP8X") return { width: 1 + data.readUIntLE(24, 3), height: 1 + data.readUIntLE(27, 3) };
    if (kind === "VP8L" && data[20] === 0x2f) return { width: 1 + (((data[22] & 0x3f) << 8) | data[21]), height: 1 + (((data[24] & 0x0f) << 10) | (data[23] << 2) | ((data[22] & 0xc0) >> 6)) };
    if (kind === "VP8 " && data[23] === 0x9d && data[24] === 0x01 && data[25] === 0x2a) return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

export async function assertSafeUpload(name: string, mimeType: string, bytes: Uint8Array) {
  const extension = path.extname(name).toLowerCase();
  if (!allowedExtensions.has(extension) || blockedMimeTypes.has(mimeType.toLowerCase())) throw new Error("This file type is not accepted. Upload an image, video, PDF, text, CSV or modern Office document.");
  const suppliedMime = mimeType.toLowerCase();
  const expectedMime = canonicalUploadMime(name);
  if (suppliedMime && suppliedMime !== "application/octet-stream" && suppliedMime !== expectedMime && !(extension === ".csv" && suppliedMime === "application/vnd.ms-excel")) throw new Error("The file extension and reported content type do not match.");
  if (extension === ".pdf" && Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-") throw new Error("The uploaded file does not contain a valid PDF signature.");
  if ([".png"].includes(extension) && !Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("The uploaded file does not contain a valid PNG signature.");
  if ([".jpg", ".jpeg"].includes(extension) && !(bytes[0] === 0xff && bytes[1] === 0xd8)) throw new Error("The uploaded file does not contain a valid JPEG signature.");
  if (extension === ".gif" && !new Set(["GIF87a", "GIF89a"]).has(Buffer.from(bytes.subarray(0, 6)).toString("ascii"))) throw new Error("The uploaded file does not contain a valid GIF signature.");
  if (extension === ".webp" && !(Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP")) throw new Error("The uploaded file does not contain a valid WebP signature.");
  if ((extension === ".mp4" || extension === ".mov") && Buffer.from(bytes.subarray(4, 8)).toString("ascii") !== "ftyp") throw new Error("The uploaded file does not contain a valid ISO media signature.");
  if (extension === ".webm" && !Buffer.from(bytes.subarray(0, 4)).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) throw new Error("The uploaded file does not contain a valid WebM signature.");
  if (new Set([".docx", ".pptx", ".xlsx"]).has(extension) && !Buffer.from(bytes.subarray(0, 4)).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) throw new Error("The uploaded Office document is not a valid ZIP-based document.");
  if (new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]).has(extension)) {
    const dimensions = imageDimensions(extension, bytes);
    if (!dimensions || dimensions.width < 1 || dimensions.height < 1) throw new Error("The uploaded image dimensions could not be verified.");
    if (dimensions.width > 20_000 || dimensions.height > 20_000 || dimensions.width * dimensions.height > 100_000_000) throw new Error("The uploaded image dimensions are too large for safe production use.");
  }
  if (!env.malwareScanUrl) {
    if (process.env.NODE_ENV === "production") throw new Error("MALWARE_SCAN_URL is required for production uploads.");
    return;
  }
  const response = await fetch(env.malwareScanUrl, {
    method: "POST",
    headers: { "content-type": "application/octet-stream", "x-file-name": encodeURIComponent(name), ...(env.malwareScanKey ? { authorization: `Bearer ${env.malwareScanKey}` } : {}) },
    body: Buffer.from(bytes),
    signal: AbortSignal.timeout(30_000)
  });
  const result = await response.json().catch(() => null) as { clean?: boolean; threat?: string } | null;
  if (!response.ok || result?.clean !== true) throw new Error(result?.threat ? `Upload rejected by malware scanning: ${result.threat}` : "The upload could not be cleared by malware scanning.");
}
