export type ProductUser = {
  id: string;
  email: string | null;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  theme: string;
  settings: Record<string, unknown>;
};

export type ListingView = {
  id: string;
  slug: string;
  type: string;
  title: string;
  outcome: string;
  budget: string;
  budgetAtomic: string | null;
  deadline: string;
  skills: string[];
  owner: string;
  ownerUserId?: string;
  invitedUserId?: string | null;
  funded: boolean;
  status: string;
  applicants: number;
  places: number;
  match: number | null;
  who: string;
  deliverables: string;
  approval: string;
  detail: Record<string, unknown>;
};

export type CreationView = {
  id: string;
  title: string;
  type: "video" | "infographic";
  state: "draft" | "production" | "review" | "completed";
  status: string;
  duration: string;
  format: string;
  edited: string;
  headline: string;
  outputKey: string | null;
  previewKey: string | null;
  thumbnailKey: string | null;
};

export type WorkItem = {
  id: string;
  entityId: string;
  listingId?: string;
  title: string;
  type: string;
  status: string;
  detail: string;
  due: string;
  route: string;
  side: string;
  offer: string;
  submitted: string;
  next: string;
  note: string;
};

export type SourceView = {
  id: string;
  kind: string;
  name: string | null;
  originalUrl: string | null;
  objectKey: string | null;
  mimeType: string | null;
  sizeBytes: string | number | null;
  isReusable: boolean;
  rights: Record<string, unknown>;
  extracted: Record<string, unknown>;
  status: string;
  updatedAt: string;
  usage?: Array<{ type: string; id: string; title: string; href: string }>;
};

export type NotificationView = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export type WorkroomView = {
  id: string;
  listingId: string;
  founderUserId: string;
  workerUserId: string;
  status: string;
  scope: Record<string, unknown>;
  permissions: Record<string, unknown>;
  escrowId: string | null;
  listing: {
    id: string; slug: string; type: string; title: string; outcome: string; detail: Record<string, unknown>;
    budgetAtomic: string | null; deadline: string | null; status: string; funded: boolean; places: number;
  };
  founder: ProductUser;
  worker: ProductUser;
  messages: Array<{ id: string; body: string; createdAt: string; author: ProductUser }>;
  deliveries: Array<{ id: string; submittedById: string; version: number; message: string; objectKeys: string[]; status: string; createdAt: string; updatedAt: string }>;
  revisions: Array<{ id: string; deliveryId: string | null; request: string; resolvedAt: string | null; createdAt: string }>;
  disputes: Array<{ id: string; reason: string; evidence: string[]; status: string; resolution: string | null; createdAt: string }>;
  reviewDeadline: string | null;
  updatedAt: string;
};

export type ReputationView = {
  id: string;
  handle: string;
  status: string;
  publicSlug: string;
  baseProfile: Record<string, unknown>;
  enhancedProfile: Record<string, unknown> | null;
  publicSettings: Record<string, unknown>;
  currentCardVersion: number;
  lastXRefreshAt: string | null;
  pausedAt: string | null;
  evidence: Array<Record<string, unknown>>;
  updatedAt: string;
};

export type PublicReputation = ReputationView & {
  userId: string;
  user: Pick<ProductUser, "displayName" | "handle" | "avatarUrl" | "bio" | "location">;
};

export type BootstrapData = {
  authenticated: boolean;
  user: ProductUser | null;
  workspaces: Array<Record<string, unknown>>;
  productions: Array<Record<string, unknown>>;
  creations: CreationView[];
  listings: ListingView[];
  ownedListings: ListingView[];
  applications: Array<Record<string, unknown>>;
  myWork: WorkItem[];
  workrooms: WorkroomView[];
  sources: SourceView[];
  vaultAssets: Array<Record<string, unknown>>;
  notifications: NotificationView[];
  reputation: ReputationView | null;
  payments?: Array<Record<string, unknown>>;
  wallet: {
    configured: boolean;
    chainId?: number;
    address: string | null;
    usdcAtomic: string | null;
    nexAtomic: string | null;
    nativeAtomic: string | null;
    error?: string;
  };
  integrations: {
    x: { configured: boolean; connected: boolean };
    telegram: { configured: boolean; connected: boolean };
    nexmind: { configured: boolean };
    heygen: { configured: boolean };
    email: { configured: boolean };
  };
};

export type ApiProblem = Error & { status?: number; code?: string; requestId?: string };
