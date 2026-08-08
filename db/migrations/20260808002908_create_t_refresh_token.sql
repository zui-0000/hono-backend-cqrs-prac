CREATE TABLE "t_refresh_token" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "t_refresh_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE INDEX "t_refresh_token_session_id_idx" ON "t_refresh_token" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "t_refresh_token_user_id_idx" ON "t_refresh_token" USING btree ("user_id");