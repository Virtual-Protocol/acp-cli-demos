export const productionKinds = ["VIDEO", "INFOGRAPHIC"] as const;
export type ProductionKind = (typeof productionKinds)[number];

export const productionStatuses = [
  "DRAFT",
  "SOURCE_PENDING",
  "SOURCE_READY",
  "DIRECTION_READY",
  "AWAITING_PAYMENT",
  "PAYMENT_PENDING",
  "PAID",
  "LIVE_SESSION_READY",
  "LIVE_SESSION_ACTIVE",
  "BRIEF_REVIEW",
  "STORYBOARD_REVIEW",
  "QUEUED",
  "REVIEWING_SOURCE",
  "BUILDING_STORY",
  "PRODUCING_SCENES",
  "ADDING_AUDIO",
  "RENDERING",
  "VERSION_READY",
  "REVISION_REQUESTED",
  "APPROVED",
  "FAILED",
  "CANCELLED",
  "REFUNDED"
] as const;

export type ProductionStatus = (typeof productionStatuses)[number];

const allowed: Record<ProductionStatus, readonly ProductionStatus[]> = {
  DRAFT: ["SOURCE_PENDING", "SOURCE_READY", "CANCELLED"],
  SOURCE_PENDING: ["SOURCE_READY", "FAILED", "CANCELLED"],
  SOURCE_READY: ["DIRECTION_READY", "CANCELLED"],
  DIRECTION_READY: ["AWAITING_PAYMENT", "CANCELLED"],
  AWAITING_PAYMENT: ["PAYMENT_PENDING", "CANCELLED"],
  PAYMENT_PENDING: ["PAID", "AWAITING_PAYMENT", "FAILED"],
  PAID: ["LIVE_SESSION_READY", "QUEUED", "REFUNDED"],
  LIVE_SESSION_READY: ["LIVE_SESSION_ACTIVE", "REFUNDED"],
  LIVE_SESSION_ACTIVE: ["BRIEF_REVIEW", "LIVE_SESSION_READY", "FAILED"],
  BRIEF_REVIEW: ["STORYBOARD_REVIEW", "QUEUED", "LIVE_SESSION_ACTIVE", "REFUNDED"],
  STORYBOARD_REVIEW: ["QUEUED", "BRIEF_REVIEW", "REFUNDED"],
  QUEUED: ["REVIEWING_SOURCE", "FAILED", "REFUNDED"],
  REVIEWING_SOURCE: ["BUILDING_STORY", "FAILED"],
  BUILDING_STORY: ["PRODUCING_SCENES", "FAILED"],
  PRODUCING_SCENES: ["ADDING_AUDIO", "RENDERING", "FAILED"],
  ADDING_AUDIO: ["RENDERING", "FAILED"],
  RENDERING: ["VERSION_READY", "FAILED"],
  VERSION_READY: ["REVISION_REQUESTED", "APPROVED"],
  REVISION_REQUESTED: ["QUEUED", "FAILED"],
  APPROVED: [],
  FAILED: ["QUEUED", "REFUNDED"],
  CANCELLED: [],
  REFUNDED: []
};

export function canTransitionProduction(from: ProductionStatus, to: ProductionStatus) {
  return allowed[from].includes(to);
}

export function assertProductionTransition(from: ProductionStatus, to: ProductionStatus) {
  if (!canTransitionProduction(from, to)) {
    throw new Error(`Invalid production transition: ${from} -> ${to}`);
  }
}

export function publicProductionState(status: ProductionStatus) {
  const map: Record<ProductionStatus, string> = {
    DRAFT: "gathering",
    SOURCE_PENDING: "gathering",
    SOURCE_READY: "shaping",
    DIRECTION_READY: "shaping",
    AWAITING_PAYMENT: "ready to confirm",
    PAYMENT_PENDING: "confirming",
    PAID: "preparing",
    LIVE_SESSION_READY: "ready to refine",
    LIVE_SESSION_ACTIVE: "shaping",
    BRIEF_REVIEW: "ready to review",
    STORYBOARD_REVIEW: "ready to review",
    QUEUED: "preparing",
    REVIEWING_SOURCE: "preparing",
    BUILDING_STORY: "shaping",
    PRODUCING_SCENES: "producing",
    ADDING_AUDIO: "producing",
    RENDERING: "producing",
    VERSION_READY: "ready",
    REVISION_REQUESTED: "shaping revision",
    APPROVED: "complete",
    FAILED: "needs attention",
    CANCELLED: "cancelled",
    REFUNDED: "refunded"
  };
  return map[status];
}
