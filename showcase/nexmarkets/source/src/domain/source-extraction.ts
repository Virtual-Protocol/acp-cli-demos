import path from "node:path";
import { inflateSync } from "node:zlib";
import { unzipSync } from "fflate";

const MAX_EXTRACTED_BYTES = 8 * 1024 * 1024;

function safeCodePoint(value: number, fallback: string) {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
    ? String.fromCodePoint(value)
    : fallback;
}

function decodeEntities(value: string) {
  const named: Record<string, string> = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.toLowerCase().startsWith("#x")) return safeCodePoint(Number.parseInt(entity.slice(2), 16), match);
    if (entity.startsWith("#")) return safeCodePoint(Number.parseInt(entity.slice(1), 10), match);
    return named[entity.toLowerCase()] ?? match;
  });
}

function normalize(value: string) {
  return decodeEntities(value)
    .replace(/\r/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, 200_000);
}

function xmlText(value: Uint8Array) {
  return normalize(new TextDecoder("utf-8", { fatal: false }).decode(value)
    .replace(/<(?:w:br|a:br|br)\b[^>]*\/?\s*>/gi, "\n")
    .replace(/<\/(?:w:p|a:p|row|si)>/gi, "\n")
    .replace(/<[^>]+>/g, " "));
}

function extractOfficeText(extension: string, bytes: Uint8Array) {
  let declared = 0;
  const archive = unzipSync(bytes, {
    filter(file) {
      const name = file.name.replaceAll("\\", "/");
      const selected = name === "[Content_Types].xml" || (extension === ".docx"
        ? name === "word/document.xml" || /^word\/(?:header|footer)\d+\.xml$/i.test(name)
        : extension === ".pptx"
          ? /^ppt\/(?:slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/i.test(name)
          : name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/i.test(name));
      if (!selected || file.originalSize > 2 * 1024 * 1024 || declared + file.originalSize > MAX_EXTRACTED_BYTES) return false;
      declared += file.originalSize;
      return true;
    },
  });
  if (!archive["[Content_Types].xml"]) throw new Error("The Office package is missing its content-type manifest.");
  const requiredPrefix = extension === ".docx" ? "word/" : extension === ".pptx" ? "ppt/" : "xl/";
  if (!Object.keys(archive).some((name) => name.startsWith(requiredPrefix))) throw new Error("The Office package does not match its file extension.");
  const names = Object.keys(archive).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  const text = normalize(names.filter((name) => name !== "[Content_Types].xml").map((name) => xmlText(archive[name])).filter(Boolean).join("\n"));
  return text.length >= 2 ? text : null;
}

function decodePdfLiteral(value: string) {
  return value.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_match, escape: string) => {
    const simple: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };
    return simple[escape] ?? String.fromCharCode(Number.parseInt(escape, 8));
  });
}

function decodePdfHex(value: string) {
  const clean = value.replace(/\s+/g, "");
  if (!/^[\da-f]*$/i.test(clean)) return "";
  const padded = clean.length % 2 ? `${clean}0` : clean;
  const data = Buffer.from(padded, "hex");
  if (data[0] === 0xfe && data[1] === 0xff) {
    let result = "";
    for (let index = 2; index + 1 < data.length; index += 2) result += String.fromCharCode(data.readUInt16BE(index));
    return result;
  }
  return data.toString("latin1");
}

function pdfOperators(value: string) {
  const parts: string[] = [];
  for (const match of value.matchAll(/\(((?:\\.|[^\\()])*)\)\s*(?:Tj|'|")/g)) parts.push(decodePdfLiteral(match[1]));
  for (const match of value.matchAll(/<([\da-f\s]+)>\s*Tj/gi)) parts.push(decodePdfHex(match[1]));
  for (const match of value.matchAll(/\[((?:[^\]]|\](?!\s*TJ))*)\]\s*TJ/gi)) {
    for (const token of match[1].matchAll(/\(((?:\\.|[^\\()])*)\)|<([\da-f\s]+)>/gi)) parts.push(token[1] !== undefined ? decodePdfLiteral(token[1]) : decodePdfHex(token[2]));
    parts.push("\n");
  }
  return parts.join(" ");
}

function extractPdfText(bytes: Uint8Array) {
  const raw = Buffer.from(bytes).toString("latin1");
  const sections = [raw];
  for (const match of raw.matchAll(/([^\r\n]{0,800}\/FlateDecode[^\r\n]{0,800})stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      sections.push(inflateSync(Buffer.from(match[2], "latin1"), { maxOutputLength: MAX_EXTRACTED_BYTES }).toString("latin1"));
    } catch {
      // A PDF can contain non-text or unsupported streams; readable streams still contribute.
    }
  }
  const text = normalize(sections.map(pdfOperators).join("\n"));
  return text.length >= 2 ? text : null;
}

export function extractReadableUpload(name: string, bytes: Uint8Array) {
  const extension = path.extname(name).toLowerCase();
  if (extension === ".txt" || extension === ".csv") {
    const text = normalize(new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/\0/g, ""));
    return text.length >= 2 ? text : null;
  }
  if (extension === ".docx" || extension === ".pptx" || extension === ".xlsx") return extractOfficeText(extension, bytes);
  if (extension === ".pdf") return extractPdfText(bytes);
  return null;
}
