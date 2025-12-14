CREATE TABLE "trading_profiles" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"enabled_setup_types" text NOT NULL,
	"max_position_size" numeric(10, 2),
	"max_concurrent_positions" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "active_watchers" ADD COLUMN "profile_id" varchar(255);--> statement-breakpoint
ALTER TABLE "trading_profiles" ADD CONSTRAINT "trading_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trading_profiles_user_id_idx" ON "trading_profiles" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "active_watchers" ADD CONSTRAINT "active_watchers_profile_id_trading_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."trading_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "active_watchers_profile_id_idx" ON "active_watchers" USING btree ("profile_id");