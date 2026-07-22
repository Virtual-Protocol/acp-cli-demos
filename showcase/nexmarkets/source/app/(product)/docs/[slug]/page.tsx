import { DocArticlePage } from "@/components/docs/DocArticlePage";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <DocArticlePage slug={slug} />;
}
