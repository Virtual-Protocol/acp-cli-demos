import type { IconName } from "./Icon";

export const routeMeta = {
  dashboard: ["Dashboard", "Creations, work, money and NexCard"],
  nexmind: ["NexMind", "Shape the decisions that turn intent into finished work"],
  nex: ["$NEX", "Price, holder access and buying guide"],
  studio: ["Studio", "Video, infographics and previous work"],
  marketplace: ["Marketplace", "Discover, post and manage work"],
  reputation: ["Reputation", "Public history, live refinement and your NexCard"],
  "buy-nex": ["Buy $NEX", "Unlock NexMind profile enhancement"],
  workroom: ["Workroom", "Accepted work, decisions and payment"],
  resources: ["Your resources", "Brand files, product facts and approved material"],
  wallet: ["Wallet & Payments", "USDC, escrow and earnings"],
  docs: ["Docs", "Create, hire, earn and manage your NexCard"],
  settings: ["Settings", "Account, workspace, privacy and accessibility"],
  admin: ["Dispute resolver", "Evidence review and on-chain escrow resolution"],
} as const;

export type ProductRoute = keyof typeof routeMeta;

export const memberRoutes: Array<[ProductRoute, string, IconName]> = [
  ["dashboard", "Dashboard", "home"],
  ["nex", "$NEX", "token"],
  ["studio", "Studio", "studio"],
  ["marketplace", "Marketplace", "market"],
  ["reputation", "Reputation", "reputation"],
];


export const guestRoutes: Array<[ProductRoute, string, IconName]> = [
  ["dashboard", "Start", "home"],
  ["studio", "Studio", "studio"],
  ["marketplace", "Marketplace", "market"],
  ["reputation", "Reputation", "reputation"],
  ["nex", "$NEX", "token"],
  ["docs", "Docs", "docs"],
];

export const memberMobileRoutes: Array<[ProductRoute, string, IconName]> = [
  ["dashboard", "Dashboard", "home"],
  ["studio", "Studio", "studio"],
  ["nex", "$NEX", "token"],
  ["marketplace", "Market", "market"],
  ["reputation", "NexCard", "reputation"],
];

export const guestMobileRoutes: Array<[ProductRoute, string, IconName]> = [
  ["dashboard", "Start", "home"],
  ["studio", "Studio", "studio"],
  ["marketplace", "Market", "market"],
  ["reputation", "Reputation", "reputation"],
  ["nex", "$NEX", "token"],
];

export function routeHref(route: ProductRoute) {
  return route === "workroom" ? "/marketplace" : `/${route}`;
}

export function routeFromPathname(pathname: string): ProductRoute {
  if (pathname.startsWith("/workrooms/")) return "workroom";
  if (pathname.startsWith("/resources")) return "resources";
  if (pathname.startsWith("/buy-nex")) return "buy-nex";
  const segment = pathname.split("/").filter(Boolean)[0] as ProductRoute | undefined;
  return segment && segment in routeMeta ? segment : "dashboard";
}
