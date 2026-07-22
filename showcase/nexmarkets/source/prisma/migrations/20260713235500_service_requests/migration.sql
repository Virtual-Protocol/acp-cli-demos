CREATE TABLE "service_requests" (
  "id" UUID NOT NULL,
  "serviceListingId" UUID NOT NULL,
  "requestListingId" UUID NOT NULL,
  "buyerUserId" UUID NOT NULL,
  "message" TEXT NOT NULL,
  "inputs" JSONB NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'FUNDS_REQUIRED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_requests_requestListingId_key" ON "service_requests"("requestListingId");
CREATE INDEX "service_requests_serviceListingId_status_idx" ON "service_requests"("serviceListingId", "status");
CREATE INDEX "service_requests_buyerUserId_status_idx" ON "service_requests"("buyerUserId", "status");

ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_serviceListingId_fkey"
FOREIGN KEY ("serviceListingId") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_requestListingId_fkey"
FOREIGN KEY ("requestListingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_buyerUserId_fkey"
FOREIGN KEY ("buyerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
