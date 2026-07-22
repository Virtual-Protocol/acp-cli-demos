import { createHash, createHmac } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

type ObjectValue = string | Uint8Array;
type RemoteConfig = {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
  sessionToken?: string;
};

function sha256(value: ObjectValue) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function awsEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function localRoot() {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), /* turbopackIgnore: true */ env.objectStorageRoot);
}

export function absoluteObjectPath(objectKey: string) {
  assertObjectKey(objectKey);
  const root = localRoot();
  const resolved = path.resolve(/* turbopackIgnore: true */ root, /* turbopackIgnore: true */ objectKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("Object key escaped the configured storage root.");
  return resolved;
}

function absolutePrefixPath(prefix: string) {
  if (!prefix || prefix.startsWith("/") || prefix.includes("\\") || prefix.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Object storage prefix is invalid.");
  }
  const root = localRoot();
  const resolved = path.resolve(/* turbopackIgnore: true */ root, /* turbopackIgnore: true */ prefix);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("Object storage prefix escaped the configured storage root.");
  return resolved;
}

export function assertObjectKey(objectKey: string) {
  if (!objectKey || objectKey.length > 1_024 || objectKey.startsWith("/") || objectKey.includes("\\") || objectKey.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Object key is invalid.");
  }
}

function remoteConfig(): RemoteConfig | null {
  if (env.objectStorageEndpoint) {
    if (!env.objectStorageBucket || !env.objectStorageAccessKey || !env.objectStorageSecretKey) {
      throw new Error("OBJECT_STORAGE_ENDPOINT, OBJECT_STORAGE_BUCKET, OBJECT_STORAGE_ACCESS_KEY and OBJECT_STORAGE_SECRET_KEY must be configured together.");
    }
    return {
      endpoint: env.objectStorageEndpoint,
      bucket: env.objectStorageBucket,
      accessKey: env.objectStorageAccessKey,
      secretKey: env.objectStorageSecretKey,
      region: env.objectStorageRegion,
      sessionToken: env.objectStorageSessionToken
    };
  }
  if (env.objectStorageAccessKey || env.objectStorageSecretKey || env.objectStorageSessionToken) {
    throw new Error("OBJECT_STORAGE_ENDPOINT is required when object-storage credentials are configured.");
  }
  const isolatedSmoke = process.env.NEXMARKETS_ISOLATED_TEST === "1" && env.databaseUrl.startsWith("file:");
  if (process.env.NODE_ENV === "production" && !isolatedSmoke) throw new Error("S3-compatible object storage must be configured in production.");
  return null;
}

function remoteObjectUrl(config: RemoteConfig, key: string, query?: URLSearchParams) {
  const endpoint = new URL(config.endpoint);
  const basePath = endpoint.pathname.replace(/^\/+|\/+$/g, "");
  const objectPath = [basePath, awsEncode(config.bucket), ...key.split("/").map(awsEncode)].filter(Boolean).join("/");
  endpoint.pathname = `/${objectPath}`;
  const canonicalQuery = [...(query?.entries() ?? [])]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue))
    .map(([name, value]) => `${awsEncode(name)}=${awsEncode(value)}`)
    .join("&");
  endpoint.search = canonicalQuery;
  return { endpoint, canonicalQuery };
}

async function remoteRequest(input: {
  method: "GET" | "PUT" | "DELETE";
  key: string;
  body?: Uint8Array;
  contentType?: string;
  query?: URLSearchParams;
}) {
  const config = remoteConfig();
  if (!config) throw new Error("Remote object storage is not configured.");
  const { endpoint, canonicalQuery } = remoteObjectUrl(config, input.key, input.query);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(input.body ?? new Uint8Array());
  const headerValues: Record<string, string> = {
    host: endpoint.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate
  };
  if (input.contentType) headerValues["content-type"] = input.contentType;
  if (config.sessionToken) headerValues["x-amz-security-token"] = config.sessionToken;
  const signedHeaderNames = Object.keys(headerValues).sort();
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headerValues[name].trim().replace(/\s+/g, " ")}\n`).join("");
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalRequest = [input.method, endpoint.pathname, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretKey}`, dateStamp), config.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const headers = new Headers(headerValues);
  headers.set("authorization", `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`);
  const response = await fetch(endpoint, { method: input.method, headers, body: input.body ? Buffer.from(input.body) : undefined, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 500);
    throw new Error(`Object storage ${input.method} failed with ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return response;
}

export function objectStorageMode() {
  return remoteConfig() ? "s3" as const : "local" as const;
}

export async function writeObject(objectKey: string, value: ObjectValue, options?: { contentType?: string; exclusive?: boolean }) {
  assertObjectKey(objectKey);
  const bytes = typeof value === "string" ? Buffer.from(value) : value;
  if (remoteConfig()) {
    await remoteRequest({ method: "PUT", key: objectKey, body: bytes, contentType: options?.contentType || "application/octet-stream" });
    return objectKey;
  }
  const target = absoluteObjectPath(objectKey);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: options?.exclusive ? "wx" : "w" });
  return objectKey;
}

export async function readObject(objectKey: string) {
  assertObjectKey(objectKey);
  if (remoteConfig()) {
    const response = await remoteRequest({ method: "GET", key: objectKey });
    return Buffer.from(await response.arrayBuffer());
  }
  return readFile(/* turbopackIgnore: true */ absoluteObjectPath(objectKey));
}

export async function deleteObject(objectKey: string) {
  assertObjectKey(objectKey);
  if (remoteConfig()) {
    await remoteRequest({ method: "DELETE", key: objectKey });
    return;
  }
  await rm(/* turbopackIgnore: true */ absoluteObjectPath(objectKey), { force: true });
}

function unescapeXml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export async function deleteObjectPrefix(prefix: string) {
  if (!remoteConfig()) {
    await rm(/* turbopackIgnore: true */ absolutePrefixPath(prefix), { recursive: true, force: true });
    return;
  }
  let continuation: string | undefined;
  do {
    const query = new URLSearchParams({ "list-type": "2", prefix });
    if (continuation) query.set("continuation-token", continuation);
    const response = await remoteRequest({ method: "GET", key: "", query });
    const xml = await response.text();
    const keys = [...xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)].map((match) => unescapeXml(match[1]));
    for (const key of keys) await deleteObject(key);
    const next = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1];
    continuation = next ? unescapeXml(next) : undefined;
  } while (continuation);
}
