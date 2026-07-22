ALTER TABLE "listings" ADD COLUMN "invitedUserId" UUID;

CREATE INDEX "listings_invitedUserId_status_idx" ON "listings"("invitedUserId", "status");

ALTER TABLE "listings" ADD CONSTRAINT "listings_invitedUserId_fkey"
FOREIGN KEY ("invitedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
