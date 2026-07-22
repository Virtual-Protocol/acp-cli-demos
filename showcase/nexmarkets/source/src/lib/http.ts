import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function requestId(request: Request) {
  return request.headers.get("x-request-id")?.slice(0, 128) || randomUUID();
}

export function json(data: unknown, requestIdValue: string, init?: ResponseInit) {
  return NextResponse.json(
    { data: serialize(data), requestId: requestIdValue },
    { ...init, headers: { "cache-control": "no-store", ...init?.headers } }
  );
}

export function problem(
  requestIdValue: string,
  status: number,
  code: string,
  title: string,
  detail: string,
  recovery?: { label: string; href?: string; action?: string }[]
) {
  return NextResponse.json(
    {
      type: `https://nexmarkets.xyz/problems/${code.toLowerCase()}`,
      title,
      status,
      detail,
      code,
      requestId: requestIdValue,
      recovery
    },
    {
      status,
      headers: {
        "content-type": "application/problem+json",
        "cache-control": "no-store"
      }
    }
  );
}

export function zodProblem(requestIdValue: string, error: ZodError) {
  const detail = error.issues
    .map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
    .join("; ");
  return problem(requestIdValue, 422, "VALIDATION_FAILED", "Request validation failed", detail);
}

export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item
    )
  ) as T;
}
