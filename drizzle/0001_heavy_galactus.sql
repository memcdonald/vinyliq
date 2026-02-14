CREATE TABLE "ai_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"artist_name" text NOT NULL,
	"title" text NOT NULL,
	"label_name" text,
	"release_date" timestamp with time zone,
	"cover_image" text,
	"description" text,
	"order_url" text,
	"source_id" uuid,
	"source_name" text,
	"collectability_score" real,
	"taste_score" real,
	"combined_score" real,
	"ai_explanation" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"priority" text NOT NULL,
	"source_name" text NOT NULL,
	"url" text,
	"category" text,
	"pulse_use" text,
	"access_method" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_suggestions_user_artist_title_idx" ON "ai_suggestions" USING btree ("user_id","artist_name","title");--> statement-breakpoint
CREATE INDEX "ai_suggestions_user_id_idx" ON "ai_suggestions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_suggestions_combined_score_idx" ON "ai_suggestions" USING btree ("combined_score");--> statement-breakpoint
CREATE INDEX "ai_suggestions_status_idx" ON "ai_suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "chat_messages_user_id_idx" ON "chat_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "data_sources_user_id_idx" ON "data_sources" USING btree ("user_id");