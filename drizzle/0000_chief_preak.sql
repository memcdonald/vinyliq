CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"album_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"evaluation" text NOT NULL,
	"score" real NOT NULL,
	"highlights" jsonb DEFAULT '[]'::jsonb,
	"concerns" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "album_artists" (
	"album_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"role" text DEFAULT 'primary' NOT NULL,
	CONSTRAINT "album_artists_album_id_artist_id_role_pk" PRIMARY KEY("album_id","artist_id","role")
);
--> statement-breakpoint
CREATE TABLE "albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discogs_id" integer,
	"discogs_master_id" integer,
	"musicbrainz_id" text,
	"spotify_id" text,
	"title" text NOT NULL,
	"year" integer,
	"thumb" text,
	"cover_image" text,
	"genres" text[] DEFAULT '{}'::text[],
	"styles" text[] DEFAULT '{}'::text[],
	"country" text,
	"discogs_url" text,
	"community_have" integer DEFAULT 0,
	"community_want" integer DEFAULT 0,
	"community_rating" real,
	"mb_tags" text[] DEFAULT '{}'::text[],
	"barcode" text,
	"catalog_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "albums_discogs_id_unique" UNIQUE("discogs_id")
);
--> statement-breakpoint
CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discogs_id" integer,
	"musicbrainz_id" text,
	"spotify_id" text,
	"name" text NOT NULL,
	"real_name" text,
	"profile" text,
	"thumb" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artists_discogs_id_unique" UNIQUE("discogs_id")
);
--> statement-breakpoint
CREATE TABLE "collection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"album_id" uuid NOT NULL,
	"status" text NOT NULL,
	"rating" integer,
	"notes" text,
	"discogs_instance_id" integer,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discogs_id" integer,
	"musicbrainz_id" text,
	"name" text NOT NULL,
	"profile" text,
	"thumb" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "labels_discogs_id_unique" UNIQUE("discogs_id")
);
--> statement-breakpoint
CREATE TABLE "pressings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"album_id" uuid NOT NULL,
	"discogs_release_id" integer,
	"title" text NOT NULL,
	"label" text,
	"country" text,
	"year" integer,
	"format" text,
	"format_details" text[],
	"catno" text,
	"barcode" text,
	"thumb" text,
	"lowest_price" real,
	"num_for_sale" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pressings_discogs_release_id_unique" UNIQUE("discogs_release_id")
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"album_id" uuid NOT NULL,
	"score" real NOT NULL,
	"strategy" text NOT NULL,
	"explanation" text NOT NULL,
	"seen" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"fetch_interval_hours" integer DEFAULT 24 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "shared_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"type" text NOT NULL,
	"album_id" uuid,
	"expires_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "upcoming_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"source_id" uuid,
	"title" text NOT NULL,
	"artist_name" text NOT NULL,
	"label_name" text,
	"release_date" timestamp with time zone,
	"cover_image" text,
	"description" text,
	"order_url" text,
	"press_run" integer,
	"colored_vinyl" boolean DEFAULT false,
	"numbered" boolean DEFAULT false,
	"special_packaging" text,
	"collectability_score" real,
	"collectability_explanation" text,
	"discogs_id" integer,
	"album_id" uuid,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"discogs_username" text,
	"discogs_access_token" text,
	"discogs_access_token_secret" text,
	"spotify_access_token" text,
	"spotify_refresh_token" text,
	"spotify_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_taste_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"genre_weights" jsonb DEFAULT '{}'::jsonb,
	"style_weights" jsonb DEFAULT '{}'::jsonb,
	"era_weights" jsonb DEFAULT '{}'::jsonb,
	"label_weights" jsonb DEFAULT '{}'::jsonb,
	"artist_weights" jsonb DEFAULT '{}'::jsonb,
	"computed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_taste_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_evaluations" ADD CONSTRAINT "ai_evaluations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_evaluations" ADD CONSTRAINT "ai_evaluations_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_artists" ADD CONSTRAINT "album_artists_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_artists" ADD CONSTRAINT "album_artists_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pressings" ADD CONSTRAINT "pressings_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_sources" ADD CONSTRAINT "release_sources_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_links" ADD CONSTRAINT "shared_links_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_links" ADD CONSTRAINT "shared_links_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upcoming_releases" ADD CONSTRAINT "upcoming_releases_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upcoming_releases" ADD CONSTRAINT "upcoming_releases_source_id_release_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."release_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upcoming_releases" ADD CONSTRAINT "upcoming_releases_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_taste_profiles" ADD CONSTRAINT "user_taste_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_evaluations_user_album_idx" ON "ai_evaluations" USING btree ("user_id","album_id");--> statement-breakpoint
CREATE INDEX "ai_evaluations_user_id_idx" ON "ai_evaluations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "album_artists_artist_id_idx" ON "album_artists" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "albums_discogs_master_id_idx" ON "albums" USING btree ("discogs_master_id");--> statement-breakpoint
CREATE INDEX "albums_musicbrainz_id_idx" ON "albums" USING btree ("musicbrainz_id");--> statement-breakpoint
CREATE INDEX "albums_spotify_id_idx" ON "albums" USING btree ("spotify_id");--> statement-breakpoint
CREATE INDEX "albums_title_idx" ON "albums" USING btree ("title");--> statement-breakpoint
CREATE INDEX "artists_musicbrainz_id_idx" ON "artists" USING btree ("musicbrainz_id");--> statement-breakpoint
CREATE INDEX "artists_spotify_id_idx" ON "artists" USING btree ("spotify_id");--> statement-breakpoint
CREATE INDEX "artists_name_idx" ON "artists" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_items_user_album_idx" ON "collection_items" USING btree ("user_id","album_id");--> statement-breakpoint
CREATE INDEX "collection_items_user_id_idx" ON "collection_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "collection_items_album_id_idx" ON "collection_items" USING btree ("album_id");--> statement-breakpoint
CREATE INDEX "labels_musicbrainz_id_idx" ON "labels" USING btree ("musicbrainz_id");--> statement-breakpoint
CREATE INDEX "labels_name_idx" ON "labels" USING btree ("name");--> statement-breakpoint
CREATE INDEX "pressings_album_id_idx" ON "pressings" USING btree ("album_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendations_user_album_strategy_idx" ON "recommendations" USING btree ("user_id","album_id","strategy");--> statement-breakpoint
CREATE INDEX "recommendations_user_id_idx" ON "recommendations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recommendations_album_id_idx" ON "recommendations" USING btree ("album_id");--> statement-breakpoint
CREATE INDEX "release_sources_user_id_idx" ON "release_sources" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shared_links_user_id_idx" ON "shared_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shared_links_token_idx" ON "shared_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "upcoming_releases_user_id_idx" ON "upcoming_releases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "upcoming_releases_source_id_idx" ON "upcoming_releases" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "upcoming_releases_release_date_idx" ON "upcoming_releases" USING btree ("release_date");--> statement-breakpoint
CREATE INDEX "user_taste_profiles_user_id_idx" ON "user_taste_profiles" USING btree ("user_id");