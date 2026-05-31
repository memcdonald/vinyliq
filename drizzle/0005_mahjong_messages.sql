CREATE TABLE "mahjong_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"hand" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mahjong_messages" ADD CONSTRAINT "mahjong_messages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mahjong_messages_user_id_idx" ON "mahjong_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mahjong_messages_created_at_idx" ON "mahjong_messages" USING btree ("created_at");