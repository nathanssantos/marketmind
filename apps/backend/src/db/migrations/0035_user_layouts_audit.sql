CREATE TABLE IF NOT EXISTS "user_layouts_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"prev_data_hash" varchar(64),
	"new_data_hash" varchar(64) NOT NULL,
	"source" varchar(64) DEFAULT 'renderer' NOT NULL,
	"client_version" varchar(20),
	"ts" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_layouts_audit" ADD CONSTRAINT "user_layouts_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_layouts_audit_user_ts_idx" ON "user_layouts_audit" ("user_id","ts");
