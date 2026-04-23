-- Wireframe source can now be either an external URL or an uploaded bundle.
ALTER TABLE "projects" ALTER COLUMN "base_wireframe_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "upload_path" text;
