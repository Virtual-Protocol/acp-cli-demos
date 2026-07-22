import { z } from "zod";
import { env } from "./env";
import { callNexMind, parseProviderJson } from "./nexmind";

const metricSchema = z.object({
  impressions: z.number().int().min(0).default(0),
  likes: z.number().int().min(0).default(0),
  replies: z.number().int().min(0).default(0),
  reposts: z.number().int().min(0).default(0),
  quotes: z.number().int().min(0).default(0),
});

const postSchema = z.object({
  id: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(500),
  createdAt: z.string().optional(),
  metrics: metricSchema.partial().default({}),
  url: z.string().optional(),
});

const nexMindReputationSchema = z.object({
  identity: z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(120),
    username: z.string().trim().min(1).max(40),
    profile_image_url: z.string().optional(),
    location: z.string().trim().max(120).optional(),
    description: z.string().trim().max(280).optional(),
    public_metrics: z.record(z.string(), z.number()).default({}),
  }),
  analysis: z.object({
    windowDays: z.number().int().min(7).max(365).default(90),
    tweetsChecked: z.number().int().min(0).default(0),
    activeDays: z.number().int().min(0).default(0),
    totals: metricSchema,
    weeklyReach: z.array(z.number().int().min(0)).max(26).default([]),
    topics: z.array(z.object({ name: z.string().trim().min(1).max(42), count: z.number().int().min(1) })).max(8).default([]),
    standout: z.array(postSchema).max(5).default([]),
    workSignature: z.string().trim().min(1).max(140),
    capabilities: z.array(z.object({ label: z.string().trim().min(1).max(28), evidenceCount: z.number().int().min(0), confirmed: z.boolean().default(false) })).max(8).default([]),
    selectedWork: z.array(z.object({ title: z.string().trim().min(1).max(48), role: z.string().trim().max(80).optional(), proofUrl: z.string().optional() })).max(4).default([]),
    activity: z.array(z.object({ month: z.string().trim().min(1).max(16), intensity: z.number().int().min(0).max(4) })).max(12).default([]),
    network: z.array(z.object({ name: z.string().trim().min(1).max(80), avatarUrl: z.string().optional(), relation: z.string().trim().min(1).max(80) })).max(6).default([]),
    desiredWork: z.array(z.string().trim().min(1).max(80)).max(6).default([]),
    availability: z.string().trim().max(160).optional(),
    analysedAt: z.string().default(() => new Date().toISOString()),
  }),
});

export type NexMindReputation = z.infer<typeof nexMindReputationSchema>;

export function normaliseXHandle(value: string) {
  return value.trim().replace(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0]?.trim();
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim() || fallback;
}

function wholeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : fallback;
}

function metricRecord(value: unknown) {
  const source = record(value);
  return {
    impressions: wholeNumber(source.impressions),
    likes: wholeNumber(source.likes),
    replies: wholeNumber(source.replies),
    reposts: wholeNumber(source.reposts),
    quotes: wholeNumber(source.quotes),
  };
}

function publicMetrics(value: unknown) {
  return Object.fromEntries(Object.entries(record(value)).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])));
}

function normaliseCapabilities(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => {
      const capability = record(item);
      const label = text(capability.label).slice(0, 28);
      if (!label) return null;
      return { label, evidenceCount: wholeNumber(capability.evidenceCount), confirmed: capability.confirmed === true };
    }).filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 8)
    : [];
}

function normaliseSelectedWork(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => {
      const work = record(item);
      const title = text(work.title).slice(0, 48);
      if (!title) return null;
      return { title, role: text(work.role).slice(0, 80) || undefined, proofUrl: text(work.proofUrl) || undefined };
    }).filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 4)
    : [];
}

function normaliseActivity(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => {
      const activity = record(item);
      const month = text(activity.month).slice(0, 16);
      if (!month) return null;
      return { month, intensity: Math.min(4, wholeNumber(activity.intensity)) };
    }).filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 12)
    : [];
}

function normaliseNetwork(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => {
      const network = record(item);
      const name = text(network.name).slice(0, 80);
      const relation = text(network.relation).slice(0, 80);
      if (!name || !relation) return null;
      return { name, relation, avatarUrl: text(network.avatarUrl) || undefined };
    }).filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 6)
    : [];
}

function normaliseDesiredWork(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => text(item).slice(0, 80)).filter(Boolean).slice(0, 6)
    : [];
}

export function normaliseReputationPayload(value: unknown, username: string) {
  const root = record(value);
  const identity = record(root.identity);
  const analysis = record(root.analysis);
  const rawStandout = Array.isArray(analysis.standout) ? analysis.standout : analysis.standoutPosts;
  const weeklyReach = Array.isArray(analysis.weeklyReach)
    ? analysis.weeklyReach.map((item) => wholeNumber(item)).slice(0, 26)
    : typeof analysis.weeklyReach === "number" && analysis.weeklyReach > 0 ? [wholeNumber(analysis.weeklyReach)] : [];
  const topics = Array.isArray(analysis.topics)
    ? analysis.topics.map((item) => {
      const topic = record(item);
      return { name: text(topic.name).slice(0, 42), count: Math.max(1, wholeNumber(topic.count, 1)) };
    }).filter((topic) => topic.name).slice(0, 8)
    : [];
  const standout = Array.isArray(rawStandout)
    ? rawStandout.map((item, index) => {
      const post = record(item);
      const body = text(post.text).slice(0, 500);
      if (!body) return null;
      return {
        id: text(post.id, String(index + 1)).slice(0, 80),
        text: body,
        createdAt: text(post.createdAt) || undefined,
        metrics: metricRecord(post.metrics),
        url: text(post.url) || undefined,
      };
    }).filter((post): post is NonNullable<typeof post> => Boolean(post)).slice(0, 5)
    : [];
  const windowDays = wholeNumber(analysis.windowDays, 90);
  const analysedAt = text(analysis.analysedAt) || new Date().toISOString();
  return {
    identity: {
      id: text(identity.id) || undefined,
      name: text(identity.name, username),
      username: text(identity.username, username).replace(/^@/, "") || username,
      profile_image_url: text(identity.profile_image_url) || undefined,
      location: text(identity.location).slice(0, 120) || undefined,
      description: text(identity.description).slice(0, 280) || undefined,
      public_metrics: publicMetrics(identity.public_metrics),
    },
    analysis: {
      windowDays: windowDays >= 7 && windowDays <= 365 ? windowDays : 90,
      tweetsChecked: wholeNumber(analysis.tweetsChecked),
      activeDays: wholeNumber(analysis.activeDays),
      totals: metricRecord(analysis.totals),
      weeklyReach,
      topics,
      standout,
      workSignature: text(analysis.workSignature, "Public X activity from @" + username).slice(0, 140),
      capabilities: normaliseCapabilities(analysis.capabilities),
      selectedWork: normaliseSelectedWork(analysis.selectedWork),
      activity: normaliseActivity(analysis.activity),
      network: normaliseNetwork(analysis.network),
      desiredWork: normaliseDesiredWork(analysis.desiredWork),
      availability: text(analysis.availability).slice(0, 160) || undefined,
      analysedAt: Number.isNaN(Date.parse(analysedAt)) ? new Date().toISOString() : analysedAt,
    },
  };
}

export async function analyseXHandleWithNexMind(handle: string) {
  const username = normaliseXHandle(handle);
  if (!/^[A-Za-z0-9_]{1,15}$/.test(username)) throw new Error("Enter a valid X handle without spaces.");
  const shape = JSON.stringify({
    identity: { name: "", username, profile_image_url: "", location: "", description: "", public_metrics: {} },
    analysis: { windowDays: 90, tweetsChecked: 0, activeDays: 0, totals: { impressions: 0, likes: 0, replies: 0, reposts: 0, quotes: 0 }, weeklyReach: [], topics: [], standout: [], workSignature: "", capabilities: [], selectedWork: [], activity: [], network: [], desiredWork: [], availability: "", analysedAt: new Date().toISOString() },
  });
  const prompt = `Use live X access to inspect @${username} and return one valid JSON object for a NexCard base profile. Use exactly this JSON shape: ${shape}. weeklyReach, topics, standout, capabilities, selectedWork, activity, network and desiredWork must always be arrays. Use the key standout, not standoutPosts. Ground every non-empty field in public X account evidence. Do not infer private role, private availability, private messages, drafts, bookmarks or non-public relationships. If a value is not publicly available, use an empty string, empty array or 0. Return only JSON.`;
  const content = await callNexMind([
    { role: "system", content: "You are NexMind, the NexMarkets reputation collector. Return only valid JSON for the requested schema." },
    { role: "user", content: prompt },
  ], { json: true, model: env.reputationNexmindModel, apiUrl: env.reputationNexmindApiUrl, apiKey: env.reputationNexmindApiKey });
  return nexMindReputationSchema.parse(normaliseReputationPayload(parseProviderJson(content), username));
}
