ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_data" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_mime_type" varchar(100);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_color" varchar(7);

ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "user_agent" varchar(500);
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "ip" varchar(64);
