import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicProfilePage } from "@/components/reputation/PublicProfilePage";
import { publicProfileByIdentifier } from "@/lib/public-profile";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const profile = await publicProfileByIdentifier(handle.replace(/^@/, ""), "handle");
  if (!profile) return { title: "NexCard unavailable · NexMarkets", robots: { index: false, follow: false } };
  const name = profile.user.displayName || profile.handle;
  return { title: `${name} · NexCard`, description: `View ${name}'s evidence-backed public NexCard on NexMarkets.`, alternates: { canonical: `/profile/${profile.publicSlug}` } };
}

export default async function Page({ params }: Props) {
  const { handle } = await params;
  const profile = await publicProfileByIdentifier(handle.replace(/^@/, ""), "handle");
  if (!profile) notFound();
  return <PublicProfilePage profile={profile} />;
}
