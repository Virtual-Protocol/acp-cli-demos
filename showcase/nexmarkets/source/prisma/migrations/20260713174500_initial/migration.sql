-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProductionKind" AS ENUM ('VIDEO', 'INFOGRAPHIC');

-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('DRAFT', 'SOURCE_PENDING', 'SOURCE_READY', 'DIRECTION_READY', 'AWAITING_PAYMENT', 'PAYMENT_PENDING', 'PAID', 'LIVE_SESSION_READY', 'LIVE_SESSION_ACTIVE', 'BRIEF_REVIEW', 'STORYBOARD_REVIEW', 'QUEUED', 'REVIEWING_SOURCE', 'BUILDING_STORY', 'PRODUCING_SCENES', 'ADDING_AUDIO', 'RENDERING', 'VERSION_READY', 'REVISION_REQUESTED', 'APPROVED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('WEBSITE', 'TEXT', 'FILE', 'X_POST', 'MARKETPLACE', 'PROJECT_SOURCE');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('PENDING', 'ANALYSING', 'READY', 'BLOCKED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'SUBMITTED', 'CONFIRMING', 'CONFIRMED', 'FAILED', 'EXPIRED', 'SETTLED', 'REFUNDED', 'ORPHANED');

-- CreateEnum
CREATE TYPE "RenderStatus" AS ENUM ('QUEUED', 'UPLOADING', 'RENDERING', 'DOWNLOADING', 'CHECKING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReputationStatus" AS ENUM ('NOT_CONNECTED', 'X_CONNECTED', 'ANALYSING', 'BASE_CARD_READY', 'ENHANCEMENT_ELIGIBLE', 'LIVE_ACTIVE', 'PROFILE_REVIEW', 'ENHANCED_CARD_READY', 'PAUSED');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('TASK', 'SERVICE', 'ROLE', 'CAMPAIGN', 'DIRECT_HIRE');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'FUNDING', 'OPEN', 'PAUSED', 'ASSIGNED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'SHORTLISTED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "WorkroomStatus" AS ENUM ('FUNDED', 'ASSIGNED', 'IN_PROGRESS', 'DELIVERED', 'REVISION_REQUESTED', 'APPROVED', 'RELEASED', 'DISPUTED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WorkspaceType" AS ENUM ('HUMAN', 'PROJECT', 'AGENT');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'AGENT');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SUBMITTED', 'REVISION_REQUESTED', 'APPROVED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "handle" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "userAgent" TEXT,
    "ipHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_challenges" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "purpose" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkspaceType" NOT NULL,
    "avatarUrl" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_memberships" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x_accounts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "scopes" JSONB NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "x_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_connections" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "chatIdEncrypted" TEXT NOT NULL,
    "username" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "telegram_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "workspaceId" UUID,
    "name" TEXT,
    "kind" "SourceKind" NOT NULL,
    "originalUrl" TEXT,
    "objectKey" TEXT,
    "mimeType" TEXT,
    "sizeBytes" BIGINT,
    "isReusable" BOOLEAN NOT NULL DEFAULT false,
    "rawTextEncrypted" TEXT,
    "extracted" JSONB,
    "rights" JSONB NOT NULL DEFAULT '{}',
    "contentHash" TEXT NOT NULL,
    "status" "SourceStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productions" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "workspaceId" UUID,
    "kind" "ProductionKind" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ProductionStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceId" UUID,
    "payerWallet" TEXT,
    "sessionParticipantUserId" UUID,
    "approverUserId" UUID,
    "direction" JSONB NOT NULL DEFAULT '{}',
    "brief" JSONB,
    "priceAtomic" BIGINT,
    "currentVersionId" UUID,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_versions" (
    "id" UUID NOT NULL,
    "productionId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "compositionObjectKey" TEXT,
    "previewObjectKey" TEXT,
    "outputObjectKey" TEXT,
    "thumbnailObjectKey" TEXT,
    "manifest" JSONB NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "productionId" UUID,
    "reputationProfileId" UUID,
    "state" TEXT NOT NULL,
    "transcriptObjectKey" TEXT,
    "context" JSONB NOT NULL DEFAULT '{}',
    "paymentReference" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_session_messages" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "speaker" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_session_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "productionId" UUID NOT NULL,
    "payer" TEXT NOT NULL,
    "standardPriceAtomic" BIGINT NOT NULL,
    "discountAtomic" BIGINT NOT NULL,
    "finalPriceAtomic" BIGINT NOT NULL,
    "nexBalanceAtomic" BIGINT NOT NULL,
    "nexThresholdAtomic" BIGINT NOT NULL,
    "payerBalanceAtomic" BIGINT NOT NULL,
    "eligible" BOOLEAN NOT NULL,
    "pricingRuleVersion" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_intents" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "productionId" UUID,
    "purpose" TEXT NOT NULL,
    "referenceId" UUID NOT NULL,
    "payer" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amountAtomic" BIGINT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "quoteExpiresAt" TIMESTAMP(3) NOT NULL,
    "txHash" TEXT,
    "contractPaymentId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "render_jobs" (
    "id" UUID NOT NULL,
    "productionId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerJobId" TEXT,
    "providerAssetId" TEXT,
    "compositionHash" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "RenderStatus" NOT NULL DEFAULT 'QUEUED',
    "outputUrl" TEXT,
    "outputObjectKey" TEXT,
    "errorCode" TEXT,
    "callbackId" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "render_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "productionId" UUID,
    "versionId" UUID,
    "artifactType" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "artifactHash" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reputation_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "handle" TEXT NOT NULL,
    "status" "ReputationStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "baseProfile" JSONB NOT NULL DEFAULT '{}',
    "enhancedProfile" JSONB,
    "publicSettings" JSONB NOT NULL DEFAULT '{}',
    "publicSlug" TEXT NOT NULL,
    "currentCardVersion" INTEGER NOT NULL DEFAULT 1,
    "lastXRefreshAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reputation_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reputation_evidence" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceDate" TIMESTAMP(3),
    "excerpt" TEXT,
    "supports" JSONB NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "confidence" INTEGER NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "reputation_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "workspaceId" UUID,
    "slug" TEXT NOT NULL,
    "type" "ListingType" NOT NULL,
    "title" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "budgetAtomic" BIGINT,
    "deadline" TIMESTAMP(3),
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "funded" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "places" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "applicantUserId" UUID NOT NULL,
    "proposedFeeAtomic" BIGINT,
    "response" TEXT NOT NULL,
    "deliveryPlan" TEXT,
    "availability" TEXT,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workrooms" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "founderUserId" UUID NOT NULL,
    "workerUserId" UUID NOT NULL,
    "status" "WorkroomStatus" NOT NULL DEFAULT 'FUNDED',
    "scope" JSONB NOT NULL DEFAULT '{}',
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "escrowId" TEXT,
    "reviewDeadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workrooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workroom_messages" (
    "id" UUID NOT NULL,
    "workroomId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workroom_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workroom_deliveries" (
    "id" UUID NOT NULL,
    "workroomId" UUID NOT NULL,
    "submittedById" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "objectKeys" JSONB NOT NULL DEFAULT '[]',
    "status" "DeliveryStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workroom_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workroom_revisions" (
    "id" UUID NOT NULL,
    "workroomId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "deliveryId" UUID,
    "request" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workroom_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workroom_disputes" (
    "id" UUID NOT NULL,
    "workroomId" UUID NOT NULL,
    "openedById" UUID NOT NULL,
    "resolvedById" UUID,
    "reason" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "resolution" JSONB,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "workroom_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deepLink" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" UUID NOT NULL,
    "destination" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chain_events" (
    "id" UUID NOT NULL,
    "chainId" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockHash" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "eventName" TEXT NOT NULL,
    "opaqueId" TEXT,
    "payload" JSONB NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "orphanedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chain_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "actorWallet" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "requestId" TEXT NOT NULL,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_status_expiresAt_idx" ON "sessions"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "auth_challenges_purpose_identifier_expiresAt_idx" ON "auth_challenges"("purpose", "identifier", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_ownerUserId_type_idx" ON "workspaces"("ownerUserId", "type");

-- CreateIndex
CREATE INDEX "workspace_memberships_userId_role_idx" ON "workspace_memberships"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_memberships_workspaceId_userId_key" ON "workspace_memberships"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "wallets_userId_isPrimary_idx" ON "wallets"("userId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_address_chainId_key" ON "wallets"("address", "chainId");

-- CreateIndex
CREATE UNIQUE INDEX "x_accounts_providerUserId_key" ON "x_accounts"("providerUserId");

-- CreateIndex
CREATE INDEX "telegram_connections_userId_revokedAt_idx" ON "telegram_connections"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "sources_ownerUserId_status_idx" ON "sources"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "sources_workspaceId_isReusable_idx" ON "sources"("workspaceId", "isReusable");

-- CreateIndex
CREATE UNIQUE INDEX "productions_currentVersionId_key" ON "productions"("currentVersionId");

-- CreateIndex
CREATE INDEX "productions_ownerUserId_status_idx" ON "productions"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "productions_status_updatedAt_idx" ON "productions"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "production_versions_productionId_versionNumber_key" ON "production_versions"("productionId", "versionNumber");

-- CreateIndex
CREATE INDEX "live_sessions_productionId_state_idx" ON "live_sessions"("productionId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "live_session_messages_sessionId_sequence_key" ON "live_session_messages"("sessionId", "sequence");

-- CreateIndex
CREATE INDEX "quotes_productionId_expiresAt_idx" ON "quotes"("productionId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_idempotencyKey_key" ON "payment_intents"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_intents_txHash_idx" ON "payment_intents"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "render_jobs_providerJobId_key" ON "render_jobs"("providerJobId");

-- CreateIndex
CREATE UNIQUE INDEX "render_jobs_idempotencyKey_key" ON "render_jobs"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "render_jobs_callbackId_key" ON "render_jobs"("callbackId");

-- CreateIndex
CREATE INDEX "render_jobs_productionId_status_idx" ON "render_jobs"("productionId", "status");

-- CreateIndex
CREATE INDEX "approvals_artifactType_artifactId_idx" ON "approvals"("artifactType", "artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "reputation_profiles_publicSlug_key" ON "reputation_profiles"("publicSlug");

-- CreateIndex
CREATE INDEX "reputation_profiles_userId_status_idx" ON "reputation_profiles"("userId", "status");

-- CreateIndex
CREATE INDEX "reputation_evidence_profileId_status_idx" ON "reputation_evidence"("profileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "listings_slug_key" ON "listings"("slug");

-- CreateIndex
CREATE INDEX "listings_status_createdAt_idx" ON "listings"("status", "createdAt");

-- CreateIndex
CREATE INDEX "listings_type_status_idx" ON "listings"("type", "status");

-- CreateIndex
CREATE INDEX "applications_applicantUserId_status_idx" ON "applications"("applicantUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "applications_listingId_applicantUserId_key" ON "applications"("listingId", "applicantUserId");

-- CreateIndex
CREATE INDEX "workrooms_founderUserId_status_idx" ON "workrooms"("founderUserId", "status");

-- CreateIndex
CREATE INDEX "workrooms_workerUserId_status_idx" ON "workrooms"("workerUserId", "status");

-- CreateIndex
CREATE INDEX "workroom_messages_workroomId_createdAt_idx" ON "workroom_messages"("workroomId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "workroom_deliveries_workroomId_version_key" ON "workroom_deliveries"("workroomId", "version");

-- CreateIndex
CREATE INDEX "workroom_revisions_workroomId_resolvedAt_idx" ON "workroom_revisions"("workroomId", "resolvedAt");

-- CreateIndex
CREATE INDEX "workroom_disputes_workroomId_status_idx" ON "workroom_disputes"("workroomId", "status");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_createdAt_idx" ON "notifications"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_outbox_dedupeKey_key" ON "notification_outbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "notification_outbox_deliveredAt_nextAttemptAt_idx" ON "notification_outbox"("deliveredAt", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "idempotency_records_expiresAt_idx" ON "idempotency_records"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_scope_key_key" ON "idempotency_records"("scope", "key");

-- CreateIndex
CREATE INDEX "chain_events_chainId_blockNumber_idx" ON "chain_events"("chainId", "blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "chain_events_chainId_transactionHash_logIndex_key" ON "chain_events"("chainId", "transactionHash", "logIndex");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_requestId_idx" ON "audit_events"("requestId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_challenges" ADD CONSTRAINT "auth_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x_accounts" ADD CONSTRAINT "x_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_connections" ADD CONSTRAINT "telegram_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_sessionParticipantUserId_fkey" FOREIGN KEY ("sessionParticipantUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "production_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_versions" ADD CONSTRAINT "production_versions_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "productions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_session_messages" ADD CONSTRAINT "live_session_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "productions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "production_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reputation_profiles" ADD CONSTRAINT "reputation_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reputation_evidence" ADD CONSTRAINT "reputation_evidence_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "reputation_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workrooms" ADD CONSTRAINT "workrooms_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workrooms" ADD CONSTRAINT "workrooms_founderUserId_fkey" FOREIGN KEY ("founderUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workrooms" ADD CONSTRAINT "workrooms_workerUserId_fkey" FOREIGN KEY ("workerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workroom_messages" ADD CONSTRAINT "workroom_messages_workroomId_fkey" FOREIGN KEY ("workroomId") REFERENCES "workrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workroom_messages" ADD CONSTRAINT "workroom_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workroom_deliveries" ADD CONSTRAINT "workroom_deliveries_workroomId_fkey" FOREIGN KEY ("workroomId") REFERENCES "workrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workroom_deliveries" ADD CONSTRAINT "workroom_deliveries_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workroom_revisions" ADD CONSTRAINT "workroom_revisions_workroomId_fkey" FOREIGN KEY ("workroomId") REFERENCES "workrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workroom_revisions" ADD CONSTRAINT "workroom_revisions_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workroom_disputes" ADD CONSTRAINT "workroom_disputes_workroomId_fkey" FOREIGN KEY ("workroomId") REFERENCES "workrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workroom_disputes" ADD CONSTRAINT "workroom_disputes_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workroom_disputes" ADD CONSTRAINT "workroom_disputes_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
