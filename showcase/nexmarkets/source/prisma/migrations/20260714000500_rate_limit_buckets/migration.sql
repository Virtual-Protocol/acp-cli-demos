CREATE TABLE "rate_limit_buckets" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rate_limit_buckets_key_category_windowStart_key" ON "rate_limit_buckets"("key", "category", "windowStart");
CREATE INDEX "rate_limit_buckets_expiresAt_idx" ON "rate_limit_buckets"("expiresAt");
