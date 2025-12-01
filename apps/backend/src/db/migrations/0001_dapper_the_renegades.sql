CREATE TABLE "setup_detections" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"interval" varchar(5) NOT NULL,
	"setup_type" varchar(100) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"stop_loss" numeric(20, 8) NOT NULL,
	"take_profit" numeric(20, 8) NOT NULL,
	"confidence" integer NOT NULL,
	"risk_reward" numeric(10, 2),
	"metadata" text,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"viewed" boolean DEFAULT false,
	"notified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "setup_detections" ADD CONSTRAINT "setup_detections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;