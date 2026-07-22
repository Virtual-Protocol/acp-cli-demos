export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function usdc(atomic: bigint | null | undefined) {
  if (atomic == null) return null;
  const whole = atomic / 1_000_000n;
  const fractional = (atomic % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole.toString();
}

export function listingView(item: {
  id: string; slug: string; type: string; title: string; outcome: string; detail: unknown;
  invitedUserId?: string | null;
  budgetAtomic: bigint | null; deadline: Date | null; funded: boolean; status: string; places: number;
  owner: { displayName: string | null; handle: string | null };
  workspace?: { name: string } | null;
  _count?: { applications: number };
}) {
  const detail = record(item.detail);
  const amount = usdc(item.budgetAtomic);
  return {
    id: item.id,
    slug: item.slug,
    type: item.type === "DIRECT_HIRE" ? "Direct Hire" : item.type.charAt(0) + item.type.slice(1).toLowerCase(),
    title: item.title,
    outcome: item.outcome,
    budget: amount == null ? "Terms set with buyer" : `${amount} USDC${item.places > 1 ? " each" : ""}`,
    budgetAtomic: item.budgetAtomic,
    deadline: item.deadline?.toISOString() ?? "Open",
    skills: strings(detail.skills),
    owner: item.workspace?.name || item.owner.displayName || (item.owner.handle ? `@${item.owner.handle}` : "NexMarkets member"),
    ownerUserId: "id" in item.owner ? (item.owner as { id?: string }).id : undefined,
    invitedUserId: item.invitedUserId ?? null,
    funded: item.funded,
    status: item.status,
    applicants: item._count?.applications ?? 0,
    places: item.places,
    match: null,
    who: typeof detail.who === "string" ? detail.who : "The person whose experience fits the published outcome.",
    deliverables: typeof detail.deliverables === "string" ? detail.deliverables : item.outcome,
    approval: typeof detail.approval === "string" ? detail.approval : "Approval follows the published scope.",
    detail
  };
}

export function productionView(item: {
  id: string; kind: string; title: string; status: string; direction: unknown; brief: unknown;
  updatedAt: Date; currentVersion?: { outputObjectKey: string | null; previewObjectKey: string | null; thumbnailObjectKey: string | null } | null;
}) {
  const direction = record(item.direction);
  const brief = record(item.brief);
  const completed = item.status === "APPROVED";
  const review = item.status === "VERSION_READY" || item.status === "REVISION_REQUESTED";
  return {
    id: item.id,
    title: item.title,
    type: item.kind.toLowerCase(),
    state: completed ? "completed" : review ? "review" : item.status === "DRAFT" ? "draft" : "production",
    status: item.status,
    duration: typeof direction.duration === "string" ? direction.duration : item.kind === "VIDEO" ? "00:30" : String(direction.size || "Image"),
    format: typeof direction.aspectRatio === "string" ? direction.aspectRatio : String(direction.size || (item.kind === "VIDEO" ? "16:9 · MP4" : "PNG")),
    edited: item.updatedAt.toISOString(),
    theme: "dark",
    headline: typeof brief.message === "string" ? brief.message : item.title,
    outputKey: item.currentVersion?.outputObjectKey ?? null,
    previewKey: item.currentVersion?.previewObjectKey ?? null,
    thumbnailKey: item.currentVersion?.thumbnailObjectKey ?? null
  };
}
