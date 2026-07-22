import content from "@/content/docs.json";

export type DocsCategory = { id: string; title: string; icon: string; description: string };
export type DocSection = { title: string; body: string; points?: string[]; ordered?: boolean };
export type DocAction = { route: string; label: string; mode?: string };
export type DocArticle = {
  id: string;
  categoryId: string;
  category: string;
  topic: string;
  summary: string;
  sections: DocSection[];
  action?: DocAction;
  facts?: [string, string][];
  keywords?: string;
};

export const docsCategories = content.categories as DocsCategory[];
export const docsArticles = content.articles as DocArticle[];

export function docHref(id: string) { return `/docs/${id}`; }

export function actionHref(action?: DocAction) {
  if (!action) return "/dashboard";
  const routes: Record<string, string> = {
    dashboard: "/dashboard", studio: "/studio", marketplace: "/marketplace", market: "/marketplace",
    reputation: "/reputation", wallet: "/wallet", nex: "/nex", vault: "/resources",
    resources: "/resources", settings: "/settings", workroom: "/marketplace?tab=my-work", docs: "/docs",
  };
  const href = routes[action.route] || "/dashboard";
  return action.mode ? `${href}${href.includes("?") ? "&" : "?"}mode=${encodeURIComponent(action.mode)}` : href;
}

export function docSearchText(article: DocArticle) {
  return [article.category, article.topic, article.summary, article.keywords || "", ...(article.facts || []).flat(), ...article.sections.flatMap((section) => [section.title, section.body, ...(section.points || [])])].join(" ").toLowerCase();
}

export function matchesDoc(article: DocArticle, query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const text = docSearchText(article);
  return terms.every((term) => text.includes(term));
}
