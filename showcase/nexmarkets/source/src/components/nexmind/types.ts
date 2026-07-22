export type NexMindPurpose = "PRODUCTION_DIRECTION" | "REPUTATION_ENHANCEMENT" | "LISTING_PREPARATION" | "APPLICATION_PREPARATION";

export type NexMindMessage = {
  id?: string;
  sequence: number;
  speaker: "USER" | "NEXMIND" | string;
  text: string;
  createdAt?: string;
};

export type ProposalField = { label: string; value: string; status: "confirmed" | "unconfirmed" | "open" };

export type NexMindProposal = {
  kind: "production" | "reputation" | "listing" | "application";
  title: string;
  summary: string;
  fields: ProposalField[];
  productionKind?: "VIDEO" | "INFOGRAPHIC";
  direction?: Record<string, unknown>;
  brief?: Record<string, unknown>;
  profile?: { role: string; workLine: string; areas: string; availability: string; location: string; northstar: string };
  listing?: Record<string, unknown>;
  application?: Record<string, unknown>;
};

export type NexMindContext = {
  outcome?: string | null;
  route?: string | null;
  userSupplied?: Record<string, unknown>;
  account?: Record<string, unknown> | null;
  production?: Record<string, unknown> | null;
  reputation?: Record<string, unknown> | null;
  sources?: Array<Record<string, unknown>>;
  currentQuestion?: string | null;
  partialTranscript?: string | null;
  liveState?: string;
  proposal?: NexMindProposal;
  confirmedAt?: string | null;
};

export type NexMindSession = {
  id: string;
  purpose: NexMindPurpose;
  productionId: string | null;
  reputationProfileId: string | null;
  state: string;
  context: NexMindContext;
  messages: NexMindMessage[];
  startedAt: string | null;
  endedAt: string | null;
  updatedAt: string;
};

export type NexMindHistoryItem = {
  id: string;
  purpose: NexMindPurpose;
  state: string;
  productionId: string | null;
  reputationProfileId: string | null;
  title: string | null;
  messageCount: number;
  lastMessage: string | null;
  startedAt: string | null;
  endedAt: string | null;
  updatedAt: string;
};

export type RouteKey = "video" | "infographic" | "post" | "application" | "find" | "reputation";

export const nexMindRouteCopy: Record<RouteKey, { label: string; title: string; productionKind?: "VIDEO" | "INFOGRAPHIC" }> = {
  video: { label: "Video", title: "New video direction", productionKind: "VIDEO" },
  infographic: { label: "Infographic", title: "New infographic direction", productionKind: "INFOGRAPHIC" },
  post: { label: "Marketplace", title: "New work Listing" },
  application: { label: "Application", title: "Marketplace application" },
  find: { label: "Work search", title: "Find suitable work" },
  reputation: { label: "Reputation", title: "NexCard enhancement" },
};

export function purposeLabel(purpose: NexMindPurpose) {
  return purpose === "PRODUCTION_DIRECTION" ? "Production brief" : purpose === "REPUTATION_ENHANCEMENT" ? "NexCard context" : purpose === "LISTING_PREPARATION" ? "Listing draft" : "Application";
}

export function routePurpose(route: RouteKey): NexMindPurpose {
  if (route === "post") return "LISTING_PREPARATION";
  if (route === "application") return "APPLICATION_PREPARATION";
  if (route === "reputation") return "REPUTATION_ENHANCEMENT";
  return "PRODUCTION_DIRECTION";
}
