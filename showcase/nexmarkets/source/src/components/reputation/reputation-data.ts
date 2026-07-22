import type { ReputationView } from "@/components/product/types";

export type XIdentity = {
  id?: string;
  name?: string;
  username?: string;
  profile_image_url?: string;
  location?: string;
  description?: string;
  public_metrics?: Record<string, number>;
};

export type XTopic = { name: string; count: number };
export type XPost = { id: string; text: string; createdAt?: string; metrics?: Record<string, number>; url?: string };
export type XAnalysis = {
  windowDays?: number;
  tweetsChecked?: number;
  activeDays?: number;
  totals?: Record<string, number>;
  weeklyReach?: number[];
  topics?: XTopic[];
  standout?: XPost[];
  analysedAt?: string;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function reputationData(profile: ReputationView) {
  const base = object(profile.baseProfile);
  const identity = object(base.identity) as XIdentity;
  const analysis = object(base.analysis) as XAnalysis;
  const enhanced = object(profile.enhancedProfile);
  const settings = object(profile.publicSettings);
  const visibility = object(settings.visibility) as Record<string, boolean>;
  return { identity, analysis, enhanced, settings, visibility };
}

export function compactNumber(value: number | undefined) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

export function topicShares(topics: XTopic[] | undefined) {
  const chosen = (topics || []).slice(0, 3);
  const total = chosen.reduce((sum, topic) => sum + topic.count, 0) || 1;
  return chosen.map((topic) => ({ ...topic, share: Math.round((topic.count / total) * 100) }));
}

export function initial(value: string | undefined) {
  return (value || "NexMarkets member").split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

export function metricTotal(metrics: Record<string, number> | undefined) {
  return Object.values(metrics || {}).reduce((sum, value) => sum + value, 0);
}
