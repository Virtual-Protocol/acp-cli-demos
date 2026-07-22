import { z } from "zod";
import { env } from "./env";

export const nexMindPurposes = [
  "PRODUCTION_DIRECTION",
  "REPUTATION_ENHANCEMENT",
  "LISTING_PREPARATION",
  "APPLICATION_PREPARATION",
] as const;

export type NexMindPurpose = (typeof nexMindPurposes)[number];

export const proposalFieldSchema = z.object({
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(2_000),
  status: z.enum(["confirmed", "unconfirmed", "open"]),
});

const commonProposal = {
  title: z.string().trim().min(2).max(140),
  summary: z.string().trim().min(2).max(2_000),
  fields: z.array(proposalFieldSchema).min(2).max(14),
};

export const productionProposalSchema = z.object({
  kind: z.literal("production"),
  ...commonProposal,
  productionKind: z.enum(["VIDEO", "INFOGRAPHIC"]),
  direction: z.record(z.string(), z.unknown()),
  brief: z.record(z.string(), z.unknown()),
});

export const reputationProposalSchema = z.object({
  kind: z.literal("reputation"),
  ...commonProposal,
  profile: z.object({
    role: z.string().trim().max(120).default(""),
    workLine: z.string().trim().min(2).max(500),
    areas: z.string().trim().max(500).default(""),
    availability: z.string().trim().max(200).default(""),
    location: z.string().trim().max(120).default(""),
    northstar: z.string().trim().max(500).default(""),
  }),
});

export const listingProposalSchema = z.object({
  kind: z.literal("listing"),
  ...commonProposal,
  listing: z.object({
    type: z.enum(["TASK", "SERVICE", "ROLE", "CAMPAIGN", "DIRECT_HIRE"]),
    outcome: z.string().trim().min(10).max(2_000),
    deliverables: z.string().trim().min(4).max(4_000),
    skills: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    who: z.string().trim().max(2_000).default(""),
    approval: z.string().trim().max(2_000).default(""),
    budgetAtomic: z.string().regex(/^\d+$/).nullable().default(null),
    deadline: z.string().datetime().nullable().default(null),
    places: z.number().int().min(1).max(100).default(1),
    serviceDeliveryDays: z.number().int().min(1).max(365).default(7),
    visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  }),
});

export const applicationProposalSchema = z.object({
  kind: z.literal("application"),
  ...commonProposal,
  application: z.object({
    listingId: z.string().uuid().nullable().default(null),
    response: z.string().trim().min(2).max(4_000),
    deliveryPlan: z.string().trim().max(4_000).default(""),
    availability: z.string().trim().max(500).default(""),
    proposedFeeAtomic: z.string().regex(/^\d+$/).nullable().default(null),
    evidenceIds: z.array(z.string().uuid()).max(30).default([]),
  }),
});

export const nexMindProposalSchema = z.discriminatedUnion("kind", [
  productionProposalSchema,
  reputationProposalSchema,
  listingProposalSchema,
  applicationProposalSchema,
]);

export type NexMindProposal = z.infer<typeof nexMindProposalSchema>;

type ProviderMessage = { role: "system" | "user" | "assistant"; content: string };

function chatCompletionsUrl(value: string) {
  const url = new URL(value);
  const path = url.pathname.replace(/\/+$/, "");
  if (!path.endsWith("/chat/completions")) url.pathname = path + "/chat/completions";
  return url.toString();
}

function providerModel(value: string) {
  const aliases: Record<string, string> = {
    "grok-4.1": "x-ai-grok-4-20",
    "grok-4.20": "x-ai-grok-4-20",
    "grok-4.3": "x-ai-grok-4-3",
    "grok-4.5": "x-ai-grok-4-5",
    "gemini-2.0-flash": "gemini-2.0-flash",
    "gemini-1.5-flash": "gemini-1.5-flash",
    "gemini-live": "gemini-2.0-flash",
  };
  return aliases[value] || value;
}

export async function callNexMind(messages: ProviderMessage[], options?: { json?: boolean; model?: string; apiUrl?: string; apiKey?: string }) {
  const apiUrl = options?.apiUrl || env.nexmindApiUrl;
  const apiKey = options?.apiKey || env.nexmindApiKey;
  if (!apiUrl || !apiKey) throw new Error("NexMind is not configured.");
  const response = await fetch(chatCompletionsUrl(apiUrl), {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: providerModel(options?.model || env.nexmindModel),
      messages,
      temperature: options?.json ? 0 : 0.2,
      ...(options?.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const body = await response.text();
  const payload = body ? JSON.parse(body) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } } : {};
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!response.ok || !content) throw new Error(payload.error?.message || `NexMind provider returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  return content;
}

export function parseProviderJson(value: string) {
  const unwrapped = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(unwrapped) as unknown;
}

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function proposalInstruction(purpose: NexMindPurpose) {
  const shared = `Return only one JSON object. Every displayed field must be grounded in the supplied context or transcript. Mark uncertain values \"unconfirmed\" and unresolved decisions \"open\". Never invent balances, evidence, claims, roles, deadlines, pricing, approvals, source facts, market data, product claims, or completed work.`;
  if (purpose === "REPUTATION_ENHANCEMENT") return `${shared} Shape: {"kind":"reputation","title":"...","summary":"...","fields":[{"label":"...","value":"...","status":"confirmed|unconfirmed|open"}],"profile":{"role":"","workLine":"","areas":"","availability":"","location":"","northstar":""}}. The profile fields must only contain statements the user explicitly confirmed. Empty strings are permitted except workLine.`;
  if (purpose === "LISTING_PREPARATION") return `${shared} Shape: {"kind":"listing","title":"...","summary":"...","fields":[...],"listing":{"type":"TASK|SERVICE|ROLE|CAMPAIGN","outcome":"...","deliverables":"...","skills":[],"who":"","approval":"","budgetAtomic":null,"deadline":null,"places":1,"serviceDeliveryDays":7,"visibility":"PUBLIC|PRIVATE"}}. budgetAtomic is USDC base units as a digit string only when explicitly confirmed. A SERVICE is a provider-owned fixed public offer, requires a positive budgetAtomic price, exactly one place, and a confirmed serviceDeliveryDays value. Direct Hire must begin from a published NexCard and must not be proposed here.`;
  if (purpose === "APPLICATION_PREPARATION") return `${shared} Shape: {"kind":"application","title":"...","summary":"...","fields":[...],"application":{"listingId":null,"response":"...","deliveryPlan":"","availability":"","proposedFeeAtomic":null,"evidenceIds":[]}}. Only use a listingId or evidenceId present in context.`;
  return `${shared} Shape: {"kind":"production","title":"...","summary":"...","fields":[...],"productionKind":"VIDEO|INFOGRAPHIC","direction":{},"brief":{}}. This is a NexMarkets Studio production lock, not a generic chat summary. direction and brief must contain the confirmed production decisions: objective, audience, destination, durationSeconds when known, format/aspectRatio when known, visualDirection, voice/audio route, sourceIds when supplied, mustInclude, mustAvoid, and unresolvedDecision fields. Put the primary approved message in brief.message. Put a concise productionLock object in brief.productionLock with Objective, Audience, Format, Duration, Core message, Structure, Visual direction, Assets, Data, External references, Voice / audio, Must include, and Must avoid when those values are known or explicitly unresolved. For videos, include a storyboard array with scene, timeRange, purpose, visual, text, motion, and audio fields where the transcript supports it.`;
}
