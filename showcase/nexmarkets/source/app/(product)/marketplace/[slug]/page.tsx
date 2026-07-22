import { ListingDetailPage } from "@/components/marketplace/ListingDetailPage";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ListingDetailPage slug={slug} />;
}
