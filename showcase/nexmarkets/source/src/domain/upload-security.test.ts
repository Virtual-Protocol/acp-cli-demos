import { describe, expect, it } from "vitest";
import { assertSafeUpload, canonicalUploadMime } from "./upload-security";

function png(width: number, height: number) {
  const bytes = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return new Uint8Array(bytes);
}

describe("upload security", () => {
  it("derives a canonical MIME type from the accepted extension", () => {
    expect(canonicalUploadMime("visual.PNG")).toBe("image/png");
    expect(canonicalUploadMime("brief.docx")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  it("accepts a bounded image with a matching signature", async () => {
    await expect(assertSafeUpload("visual.png", "image/png", png(1200, 628))).resolves.toBeUndefined();
  });

  it("rejects extension/MIME confusion and oversized image dimensions", async () => {
    await expect(assertSafeUpload("visual.png", "text/html", png(1200, 628))).rejects.toThrow("not accepted");
    await expect(assertSafeUpload("visual.png", "image/jpeg", png(1200, 628))).rejects.toThrow("do not match");
    await expect(assertSafeUpload("visual.png", "image/png", png(20_001, 10))).rejects.toThrow("too large");
  });

  it("does not trust a filename when the binary signature is wrong", async () => {
    await expect(assertSafeUpload("report.pdf", "application/pdf", new TextEncoder().encode("<html>not a pdf</html>")))
      .rejects.toThrow("valid PDF signature");
  });
});
