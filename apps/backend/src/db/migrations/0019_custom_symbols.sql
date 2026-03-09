CREATE TABLE IF NOT EXISTS "custom_symbols" (
  "id" serial PRIMARY KEY NOT NULL,
  "symbol" varchar(30) NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text,
  "category" varchar(50) NOT NULL,
  "base_value" numeric(20, 8) DEFAULT '100' NOT NULL,
  "weighting_method" varchar(30) DEFAULT 'CAPPED_MARKET_CAP' NOT NULL,
  "cap_percent" numeric(5, 2) DEFAULT '40',
  "rebalance_interval_days" integer DEFAULT 30,
  "last_rebalanced_at" timestamp,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "custom_symbols_symbol_unique" UNIQUE("symbol")
);

CREATE TABLE IF NOT EXISTS "custom_symbol_components" (
  "id" serial PRIMARY KEY NOT NULL,
  "custom_symbol_id" integer NOT NULL REFERENCES "custom_symbols"("id") ON DELETE CASCADE,
  "symbol" varchar(20) NOT NULL,
  "market_type" varchar(10) DEFAULT 'SPOT' NOT NULL,
  "coingecko_id" varchar(100),
  "weight" numeric(10, 8) NOT NULL,
  "base_price" numeric(20, 8),
  "is_active" boolean DEFAULT true NOT NULL,
  "added_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "custom_symbol_components_custom_symbol_id_symbol_market_type_unique" UNIQUE("custom_symbol_id", "symbol", "market_type")
);

CREATE INDEX IF NOT EXISTS "custom_symbol_components_idx" ON "custom_symbol_components" ("custom_symbol_id");
