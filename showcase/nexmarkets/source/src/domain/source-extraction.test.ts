import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { extractReadableUpload } from "./source-extraction";

describe("source extraction", () => {
  it("normalizes text and CSV uploads without inventing content", () => {
    expect(extractReadableUpload("brief.txt", new TextEncoder().encode("  Approved\tlaunch brief\n\nSecond line  ")))
      .toBe("Approved launch brief\nSecond line");
    expect(extractReadableUpload("facts.csv", new TextEncoder().encode("name,value\nNEX,50000")))
      .toContain("NEX,50000");
  });

  it("reads the text-bearing XML from a DOCX package", () => {
    const bytes = zipSync({
      "[Content_Types].xml": strToU8("<Types><Default Extension=\"xml\" ContentType=\"application/xml\"/></Types>"),
      "word/document.xml": strToU8("<w:document><w:body><w:p><w:r><w:t>Verified &amp; approved</w:t></w:r></w:p><w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p></w:body></w:document>"),
    });
    expect(extractReadableUpload("source.docx", bytes)).toBe("Verified & approved\nSecond paragraph");
  });

  it("extracts common PDF text operators and rejects unreadable binaries", () => {
    const readable = new TextEncoder().encode("%PDF-1.4\nBT (NexMarkets \\(approved\\) brief) Tj ET\n%%EOF");
    expect(extractReadableUpload("brief.pdf", readable)).toContain("NexMarkets (approved) brief");
    expect(extractReadableUpload("empty.pdf", new TextEncoder().encode("%PDF-1.4\n%%EOF"))).toBeNull();
  });

  it("rejects an Office extension whose package does not match", () => {
    const bytes = zipSync({
      "[Content_Types].xml": strToU8("<Types />"),
      "xl/worksheets/sheet1.xml": strToU8("<worksheet><row><c><v>42</v></c></row></worksheet>"),
    });
    expect(() => extractReadableUpload("renamed.docx", bytes)).toThrow("does not match");
  });
});
