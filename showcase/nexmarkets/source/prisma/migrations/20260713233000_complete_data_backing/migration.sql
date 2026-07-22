-- Bring the production PostgreSQL schema in line with the complete Prisma model.
ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "quotes" ADD COLUMN "chainConfigVersion" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "quotes" ALTER COLUMN "chainConfigVersion" DROP DEFAULT;

CREATE TABLE "drafts" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "workspaceId" UUID,
    "kind" "ProductionKind" NOT NULL,
    "title" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "drafts_ownerUserId_updatedAt_idx" ON "drafts"("ownerUserId", "updatedAt");

ALTER TABLE "drafts" ADD CONSTRAINT "drafts_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
