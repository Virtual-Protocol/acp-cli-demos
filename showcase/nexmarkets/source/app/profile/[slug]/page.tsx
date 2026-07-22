import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicProfilePage } from "@/components/reputation/PublicProfilePage";
import { publicProfileByIdentifier } from "@/lib/public-profile";
import { record } from "@/lib/product-view";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await publicProfileByIdentifier(slug);
  if (!profile) return { title: "NexCard unavailable · NexMarkets", robots: { index: false, follow: false } };
  const base = record(profile.baseProfile);
  const identity = record(base.identity);
  const enhanced = record(profile.enhancedProfile);
  const visibility = record(record(profile.publicSettings).visibility);
  const name = typeof identity.name === "string" ? identity.name : profile.user.displayName || profile.handle;
  const description = visibility.workLine === true && typeof enhanced.workLine === "string" ? enhanced.workLine : typeof identity.description === "string" ? identity.description : `View ${name}'s evidence-backed NexCard on NexMarkets.`;
  return { title: `${name} · NexCard`, description: description.slice(0, 180), alternates: { canonical: `/profile/${profile.publicSlug}` }, openGraph: { title: `${name} · NexCard`, description: description.slice(0, 180), type: "website" } };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const profile = await publicProfileByIdentifier(slug);
  if (!profile) notFound();
  return <PublicProfilePage profile={profile} />;
}
