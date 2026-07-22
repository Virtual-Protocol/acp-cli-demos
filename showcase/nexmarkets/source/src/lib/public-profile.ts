import { getPrisma } from "./db";
import { serialize } from "./http";
import { record } from "./product-view";
import { env } from "./env";
import type { PublicReputation } from "@/components/product/types";

export async function publicProfileByIdentifier(identifier: string, mode: "slug" | "handle" = "slug"): Promise<PublicReputation | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  const profile = await prisma.reputationProfile.findFirst({
    where: mode === "slug" ? { publicSlug: identifier } : env.databaseProvider === "postgresql" ? { handle: { equals: identifier, mode: "insensitive" } } : { handle: identifier },
    include: {
      user: { select: { displayName: true, handle: true, avatarUrl: true, bio: true, location: true } },
      evidence: { where: { visibility: "PUBLIC", status: "VERIFIED" } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const settings = record(profile?.publicSettings);
  return profile && settings.published === true && !profile.pausedAt
    ? serialize(profile) as unknown as PublicReputation
    : null;
}
