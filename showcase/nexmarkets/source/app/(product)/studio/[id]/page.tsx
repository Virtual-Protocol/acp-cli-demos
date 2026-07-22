import { CreationDetailPage } from "@/components/studio/CreationDetailPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CreationDetailPage id={id} />;
}
