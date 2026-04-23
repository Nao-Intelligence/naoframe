-- Plaintext share-link tokens so admin can re-display the URL anytime.
-- Existing hashed tokens can't be recovered, so any existing rows are discarded.

DELETE FROM "share_links";
ALTER TABLE "share_links" DROP COLUMN "token_hash";
ALTER TABLE "share_links" ADD COLUMN "token" text NOT NULL;
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_token_unique" UNIQUE ("token");
