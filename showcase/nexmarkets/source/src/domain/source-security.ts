import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { isDevSimulationEnabled } from "@/lib/dev-simulation";

const blockedHosts = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "instance-data.ec2.internal"
]);

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

function isPrivateIp(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

export async function assertPublicHttpUrl(value: string) {
  const url = new URL(value);
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error("Only public HTTP and HTTPS sources are supported");
  }
  if (isDevSimulationEnabled()) return url;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (blockedHosts.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Private network sources are not supported");
  }
  if (isIP(hostname) && isPrivateIp(hostname)) {
    throw new Error("Private network sources are not supported");
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error("The source resolved to a restricted network address");
  }
  return url;
}

async function readLimitedBody(response: Response, maximumBytes: number) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new Error(`The remote resource is larger than ${maximumBytes} bytes.`);
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel("Remote resource exceeded the configured limit");
        throw new Error(`The remote resource is larger than ${maximumBytes} bytes.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function fetchPublicBytes(value: string, options: {
  maximumBytes: number;
  acceptedContentTypes: readonly string[];
  timeoutMs?: number;
  userAgent?: string;
}) {
  let current = await assertPublicHttpUrl(value);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(current, {
      headers: {
        "user-agent": options.userAgent || "NexMarketsSourceReader/1.0",
        accept: options.acceptedContentTypes.join(","),
      },
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
    });
    if (redirectStatuses.has(response.status)) {
      if (redirects === 3) throw new Error("The remote resource redirected too many times.");
      const location = response.headers.get("location");
      if (!location) throw new Error("The remote resource returned a redirect without a destination.");
      current = await assertPublicHttpUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`The remote resource returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "application/octet-stream";
    if (!options.acceptedContentTypes.some((accepted) => contentType === accepted || (accepted.endsWith("/*") && contentType.startsWith(accepted.slice(0, -1))))) {
      throw new Error(`The remote resource has unsupported content type ${contentType}.`);
    }
    return {
      bytes: await readLimitedBody(response, options.maximumBytes),
      contentType,
      finalUrl: current.toString(),
    };
  }
  throw new Error("The remote resource could not be read.");
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.toLowerCase().startsWith("#x")) {
      const value = Number.parseInt(entity.slice(2), 16);
      return Number.isInteger(value) && value >= 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : match;
    }
    if (entity.startsWith("#")) {
      const value = Number.parseInt(entity.slice(1), 10);
      return Number.isInteger(value) && value >= 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function readableText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|template|svg|canvas)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|article|section|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  ).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim().slice(0, 200_000);
}

export async function capturePublicPage(value: string) {
  const resource = await fetchPublicBytes(value, {
    maximumBytes: 25_000_000,
    acceptedContentTypes: ["text/html", "text/plain", "application/xhtml+xml"],
  });
  const raw = new TextDecoder("utf-8", { fatal: false }).decode(resource.bytes);
  const text = resource.contentType === "text/plain" ? raw.replace(/\s+/g, " ").trim().slice(0, 200_000) : readableText(raw);
  if (text.length < 20) throw new Error("The source did not contain enough readable text.");
  const rawTitle = resource.contentType === "text/plain" ? "" : raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  return {
    ...resource,
    text,
    title: decodeHtmlEntities(rawTitle.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 200) || null,
  };
}
