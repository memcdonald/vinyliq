CREATE TABLE "site_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "discogs_consumer_key" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "discogs_consumer_secret" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "spotify_client_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "spotify_client_secret" text;--> statement-breakpoint
ALTER TABLE "user_taste_profiles" ADD COLUMN "ai_preference_analysis" jsonb;