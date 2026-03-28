CREATE TABLE IF NOT EXISTS "user_layouts" (
  "id" serial PRIMARY KEY,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "data" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_layouts_user_id_unique" UNIQUE("user_id")
);
