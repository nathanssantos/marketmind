CREATE TABLE "active_watchers" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"wallet_id" varchar(255) NOT NULL,
	"profile_id" varchar(255),
	"symbol" varchar(20) NOT NULL,
	"interval" varchar(5) NOT NULL,
	"market_type" varchar(10) DEFAULT 'FUTURES' NOT NULL,
	"exchange" varchar(20) DEFAULT 'BINANCE',
	"is_manual" boolean DEFAULT true NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"key_encrypted" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_user_id_provider_unique" UNIQUE("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "auto_trading_config" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"wallet_id" varchar(255) NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"max_concurrent_positions" integer DEFAULT 5 NOT NULL,
	"max_position_size" numeric(10, 2) DEFAULT '15' NOT NULL,
	"daily_loss_limit" numeric(10, 2) DEFAULT '5' NOT NULL,
	"enabled_setup_types" text NOT NULL,
	"position_sizing" varchar(20) DEFAULT 'percentage',
	"leverage" integer DEFAULT 1,
	"margin_type" varchar(10) DEFAULT 'ISOLATED',
	"position_mode" varchar(10) DEFAULT 'ONE_WAY',
	"use_limit_orders" boolean DEFAULT false NOT NULL,
	"use_stochastic_filter" boolean DEFAULT false NOT NULL,
	"use_stochastic_recovery_filter" boolean DEFAULT false NOT NULL,
	"use_momentum_timing_filter" boolean DEFAULT true NOT NULL,
	"use_adx_filter" boolean DEFAULT false NOT NULL,
	"use_trend_filter" boolean DEFAULT false NOT NULL,
	"use_mtf_filter" boolean DEFAULT false NOT NULL,
	"use_btc_correlation_filter" boolean DEFAULT true NOT NULL,
	"use_market_regime_filter" boolean DEFAULT false NOT NULL,
	"use_direction_filter" boolean DEFAULT false NOT NULL,
	"direction_mode" varchar(15) DEFAULT 'auto' NOT NULL,
	"enable_long_in_bear_market" boolean DEFAULT false NOT NULL,
	"enable_short_in_bull_market" boolean DEFAULT false NOT NULL,
	"use_volume_filter" boolean DEFAULT true NOT NULL,
	"volume_filter_obv_lookback_long" integer DEFAULT 7,
	"volume_filter_obv_lookback_short" integer DEFAULT 5,
	"use_obv_check_long" boolean DEFAULT false,
	"use_obv_check_short" boolean DEFAULT true,
	"use_funding_filter" boolean DEFAULT false NOT NULL,
	"use_confluence_scoring" boolean DEFAULT false NOT NULL,
	"confluence_min_score" integer DEFAULT 60 NOT NULL,
	"use_choppiness_filter" boolean DEFAULT false NOT NULL,
	"choppiness_threshold_high" numeric(5, 2) DEFAULT '61.80',
	"choppiness_threshold_low" numeric(5, 2) DEFAULT '38.20',
	"choppiness_period" integer DEFAULT 14,
	"use_session_filter" boolean DEFAULT false NOT NULL,
	"session_start_utc" integer DEFAULT 13,
	"session_end_utc" integer DEFAULT 16,
	"use_bollinger_squeeze_filter" boolean DEFAULT false NOT NULL,
	"bollinger_squeeze_threshold" numeric(5, 3) DEFAULT '0.100',
	"bollinger_squeeze_period" integer DEFAULT 20,
	"bollinger_squeeze_std_dev" numeric(4, 2) DEFAULT '2.00',
	"use_vwap_filter" boolean DEFAULT false NOT NULL,
	"use_super_trend_filter" boolean DEFAULT false NOT NULL,
	"super_trend_period" integer DEFAULT 10,
	"super_trend_multiplier" numeric(4, 2) DEFAULT '3.00',
	"max_drawdown_enabled" boolean DEFAULT false,
	"max_drawdown_percent" numeric(5, 2) DEFAULT '15',
	"margin_top_up_enabled" boolean DEFAULT false,
	"margin_top_up_threshold" numeric(5, 2) DEFAULT '30',
	"margin_top_up_percent" numeric(5, 2) DEFAULT '10',
	"margin_top_up_max_count" integer DEFAULT 3,
	"position_size_percent" numeric(5, 2) DEFAULT '10.00' NOT NULL,
	"max_global_exposure_percent" numeric(5, 2) DEFAULT '100.00' NOT NULL,
	"min_risk_reward_ratio_long" numeric(4, 2) DEFAULT '0.75',
	"min_risk_reward_ratio_short" numeric(4, 2) DEFAULT '0.75',
	"max_fibonacci_entry_progress_percent" integer DEFAULT 100 NOT NULL,
	"tp_calculation_mode" varchar(20) DEFAULT 'fibonacci' NOT NULL,
	"fibonacci_target_level" varchar(10) DEFAULT '2' NOT NULL,
	"fibonacci_target_level_long" varchar(10) DEFAULT '2' NOT NULL,
	"fibonacci_target_level_short" varchar(10) DEFAULT '1.272' NOT NULL,
	"fibonacci_swing_range" varchar(10) DEFAULT 'nearest' NOT NULL,
	"use_dynamic_symbol_selection" boolean DEFAULT false NOT NULL,
	"dynamic_symbol_rotation_interval" varchar(10) DEFAULT '4h' NOT NULL,
	"dynamic_symbol_excluded" text,
	"enable_auto_rotation" boolean DEFAULT true NOT NULL,
	"trailing_stop_mode" varchar(10) DEFAULT 'local',
	"trailing_stop_enabled" boolean DEFAULT true NOT NULL,
	"trailing_activation_percent_long" numeric(5, 4) DEFAULT '0.9' NOT NULL,
	"trailing_activation_percent_short" numeric(5, 4) DEFAULT '0.8' NOT NULL,
	"trailing_distance_percent_long" numeric(5, 4) DEFAULT '0.4' NOT NULL,
	"trailing_distance_percent_short" numeric(5, 4) DEFAULT '0.3' NOT NULL,
	"use_adaptive_trailing" boolean DEFAULT true NOT NULL,
	"use_profit_lock_distance" boolean DEFAULT false NOT NULL,
	"trailing_activation_mode_long" varchar(10) DEFAULT 'auto' NOT NULL,
	"trailing_activation_mode_short" varchar(10) DEFAULT 'auto' NOT NULL,
	"pyramiding_enabled" boolean DEFAULT false NOT NULL,
	"pyramiding_mode" varchar(20) DEFAULT 'static' NOT NULL,
	"max_pyramid_entries" integer DEFAULT 5 NOT NULL,
	"pyramid_profit_threshold" numeric(5, 4) DEFAULT '0.01' NOT NULL,
	"pyramid_scale_factor" numeric(4, 2) DEFAULT '0.80' NOT NULL,
	"pyramid_min_distance" numeric(5, 4) DEFAULT '0.005' NOT NULL,
	"pyramid_use_atr" boolean DEFAULT true NOT NULL,
	"pyramid_use_adx" boolean DEFAULT true NOT NULL,
	"pyramid_use_rsi" boolean DEFAULT false NOT NULL,
	"pyramid_adx_threshold" integer DEFAULT 25 NOT NULL,
	"pyramid_rsi_lower_bound" integer DEFAULT 40 NOT NULL,
	"pyramid_rsi_upper_bound" integer DEFAULT 60 NOT NULL,
	"pyramid_fibo_levels" text DEFAULT '["1", "1.272", "1.618"]',
	"leverage_aware_pyramid" boolean DEFAULT true NOT NULL,
	"opportunity_cost_enabled" boolean DEFAULT false NOT NULL,
	"max_holding_period_bars" integer DEFAULT 20 NOT NULL,
	"stale_price_threshold_percent" numeric(5, 2) DEFAULT '0.5' NOT NULL,
	"stale_trade_action" varchar(20) DEFAULT 'TIGHTEN_STOP' NOT NULL,
	"time_based_stop_tightening_enabled" boolean DEFAULT true NOT NULL,
	"time_tighten_after_bars" integer DEFAULT 10 NOT NULL,
	"time_tighten_percent_per_bar" numeric(5, 2) DEFAULT '5' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indicator_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"indicator_type" varchar(50) NOT NULL,
	"value" numeric(20, 8) NOT NULL,
	"metadata" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "klines" (
	"symbol" varchar(20) NOT NULL,
	"interval" varchar(5) NOT NULL,
	"market_type" varchar(10) DEFAULT 'FUTURES' NOT NULL,
	"open_time" timestamp NOT NULL,
	"close_time" timestamp NOT NULL,
	"open" numeric(20, 8) NOT NULL,
	"high" numeric(20, 8) NOT NULL,
	"low" numeric(20, 8) NOT NULL,
	"close" numeric(20, 8) NOT NULL,
	"volume" numeric(20, 8) NOT NULL,
	"quote_volume" numeric(20, 8),
	"trades" integer,
	"taker_buy_base_volume" numeric(20, 8),
	"taker_buy_quote_volume" numeric(20, 8),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "klines_symbol_interval_market_type_open_time_pk" PRIMARY KEY("symbol","interval","market_type","open_time")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"order_id" bigint PRIMARY KEY NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"side" varchar(10) NOT NULL,
	"type" varchar(30) NOT NULL,
	"price" varchar(50),
	"orig_qty" varchar(50),
	"executed_qty" varchar(50),
	"status" varchar(30) NOT NULL,
	"time_in_force" varchar(10),
	"time" bigint,
	"update_time" bigint,
	"user_id" varchar(255) NOT NULL,
	"wallet_id" varchar(255) NOT NULL,
	"setup_id" varchar(255),
	"setup_type" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"market_type" varchar(10) DEFAULT 'FUTURES',
	"reduce_only" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "pair_maintenance_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"interval" text NOT NULL,
	"market_type" text NOT NULL,
	"last_gap_check" timestamp,
	"last_corruption_check" timestamp,
	"gaps_found" integer DEFAULT 0,
	"corrupted_fixed" integer DEFAULT 0,
	"earliest_kline_date" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pair_maintenance_log_symbol_interval_market_type_unique" UNIQUE("symbol","interval","market_type")
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"wallet_id" varchar(255) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"side" varchar(10) NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"entry_qty" numeric(20, 8) NOT NULL,
	"current_price" numeric(20, 8),
	"stop_loss" numeric(20, 8),
	"take_profit" numeric(20, 8),
	"pnl" numeric(20, 8),
	"pnl_percent" numeric(10, 2),
	"status" varchar(20) DEFAULT 'open',
	"closed_at" timestamp,
	"setup_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"market_type" varchar(10) DEFAULT 'FUTURES',
	"leverage" integer DEFAULT 1,
	"margin_type" varchar(10),
	"liquidation_price" numeric(20, 8),
	"accumulated_funding" numeric(20, 8) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "price_cache" (
	"symbol" varchar(20) PRIMARY KEY NOT NULL,
	"price" numeric(20, 8) NOT NULL,
	"timestamp" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setup_detections" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"interval" varchar(5) NOT NULL,
	"setup_type" varchar(100) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"stop_loss" numeric(20, 8),
	"take_profit" numeric(20, 8),
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
CREATE TABLE "strategy_performance" (
	"id" serial PRIMARY KEY NOT NULL,
	"strategy_id" varchar(100) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"interval" varchar(10) NOT NULL,
	"total_trades" integer DEFAULT 0 NOT NULL,
	"winning_trades" integer DEFAULT 0 NOT NULL,
	"losing_trades" integer DEFAULT 0 NOT NULL,
	"breakeven_trades" integer DEFAULT 0 NOT NULL,
	"win_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"total_pnl" numeric(20, 8) DEFAULT '0' NOT NULL,
	"total_pnl_percent" numeric(10, 4) DEFAULT '0' NOT NULL,
	"avg_win" numeric(10, 4) DEFAULT '0' NOT NULL,
	"avg_loss" numeric(10, 4) DEFAULT '0' NOT NULL,
	"avg_rr" numeric(10, 4) DEFAULT '0' NOT NULL,
	"max_drawdown" numeric(10, 4) DEFAULT '0' NOT NULL,
	"max_consecutive_losses" integer DEFAULT 0 NOT NULL,
	"current_consecutive_losses" integer DEFAULT 0 NOT NULL,
	"avg_slippage_percent" numeric(10, 4) DEFAULT '0' NOT NULL,
	"avg_execution_time_ms" integer DEFAULT 0 NOT NULL,
	"last_trade_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "strategy_performance_strategy_id_symbol_interval_unique" UNIQUE("strategy_id","symbol","interval")
);
--> statement-breakpoint
CREATE TABLE "symbol_trailing_stop_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" varchar(255) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"use_individual_config" boolean DEFAULT false NOT NULL,
	"trailing_stop_enabled" boolean,
	"trailing_activation_percent_long" numeric(5, 4),
	"trailing_activation_percent_short" numeric(5, 4),
	"trailing_distance_percent_long" numeric(5, 4),
	"trailing_distance_percent_short" numeric(5, 4),
	"use_adaptive_trailing" boolean,
	"use_profit_lock_distance" boolean,
	"trailing_activation_mode_long" varchar(10),
	"trailing_activation_mode_short" varchar(10),
	"manual_trailing_activated_long" boolean DEFAULT false,
	"manual_trailing_activated_short" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_cooldowns" (
	"id" serial PRIMARY KEY NOT NULL,
	"strategy_id" varchar(100) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"interval" varchar(10) NOT NULL,
	"last_execution_id" varchar(50) NOT NULL,
	"last_execution_at" timestamp NOT NULL,
	"cooldown_until" timestamp NOT NULL,
	"cooldown_minutes" integer NOT NULL,
	"wallet_id" varchar(50) NOT NULL,
	"reason" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trade_cooldowns_strategy_id_symbol_interval_wallet_id_unique" UNIQUE("strategy_id","symbol","interval","wallet_id")
);
--> statement-breakpoint
CREATE TABLE "trade_executions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"wallet_id" varchar(255) NOT NULL,
	"setup_id" varchar(255),
	"setup_type" varchar(100),
	"symbol" varchar(20) NOT NULL,
	"side" varchar(10) NOT NULL,
	"entry_order_id" bigint,
	"stop_loss_order_id" bigint,
	"take_profit_order_id" bigint,
	"order_list_id" bigint,
	"exit_order_id" bigint,
	"entry_price" numeric(20, 8) NOT NULL,
	"exit_price" numeric(20, 8),
	"quantity" numeric(20, 8) NOT NULL,
	"stop_loss" numeric(20, 8),
	"take_profit" numeric(20, 8),
	"pnl" numeric(20, 8),
	"pnl_percent" numeric(10, 2),
	"fees" numeric(20, 8) DEFAULT '0',
	"exit_source" varchar(50),
	"exit_reason" varchar(50),
	"opened_at" timestamp NOT NULL,
	"closed_at" timestamp,
	"status" varchar(20) DEFAULT 'open',
	"entry_order_type" varchar(10) DEFAULT 'MARKET',
	"limit_entry_price" numeric(20, 8),
	"expires_at" timestamp,
	"market_type" varchar(10) DEFAULT 'FUTURES',
	"leverage" integer DEFAULT 1,
	"liquidation_price" numeric(20, 8),
	"accumulated_funding" numeric(20, 8) DEFAULT '0',
	"position_side" varchar(10) DEFAULT 'BOTH',
	"margin_top_up_count" integer DEFAULT 0,
	"trigger_kline_index" integer,
	"trigger_kline_open_time" bigint,
	"trigger_candle_data" text,
	"trigger_indicator_values" text,
	"fibonacci_projection" text,
	"entry_fee" numeric(20, 8),
	"exit_fee" numeric(20, 8),
	"commission_asset" varchar(20),
	"trailing_stop_algo_id" bigint,
	"trailing_stop_mode" varchar(10),
	"stop_loss_algo_id" bigint,
	"take_profit_algo_id" bigint,
	"stop_loss_is_algo" boolean DEFAULT false,
	"take_profit_is_algo" boolean DEFAULT false,
	"entry_interval" varchar(10),
	"bars_in_trade" integer DEFAULT 0,
	"last_price_movement_bar" integer DEFAULT 0,
	"highest_price_since_entry" numeric(20, 8),
	"lowest_price_since_entry" numeric(20, 8),
	"trailing_activated_at" timestamp,
	"highest_price_since_trailing_activation" numeric(20, 8),
	"lowest_price_since_trailing_activation" numeric(20, 8),
	"opportunity_cost_alert_sent_at" timestamp,
	"original_stop_loss" numeric(20, 8),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "trading_setups" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"type" varchar(100) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"interval" varchar(5) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"stop_loss" numeric(20, 8) NOT NULL,
	"take_profit" numeric(20, 8) NOT NULL,
	"confidence" integer NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"order_id" bigint,
	"status" varchar(20) DEFAULT 'pending',
	"pnl" numeric(20, 8),
	"pnl_percent" numeric(10, 2),
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_category_key_unique" UNIQUE("user_id","category","key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"wallet_type" varchar(20) DEFAULT 'paper',
	"market_type" varchar(10) DEFAULT 'FUTURES',
	"api_key_encrypted" text NOT NULL,
	"api_secret_encrypted" text NOT NULL,
	"initial_balance" numeric(20, 8),
	"current_balance" numeric(20, 8),
	"total_deposits" numeric(20, 8) DEFAULT '0',
	"total_withdrawals" numeric(20, 8) DEFAULT '0',
	"last_transfer_sync_at" timestamp,
	"currency" varchar(10) DEFAULT 'USDT',
	"exchange" varchar(20) DEFAULT 'BINANCE',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "active_watchers" ADD CONSTRAINT "active_watchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_watchers" ADD CONSTRAINT "active_watchers_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_watchers" ADD CONSTRAINT "active_watchers_profile_id_trading_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."trading_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD CONSTRAINT "auto_trading_config_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD CONSTRAINT "auto_trading_config_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup_detections" ADD CONSTRAINT "setup_detections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbol_trailing_stop_overrides" ADD CONSTRAINT "symbol_trailing_stop_overrides_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD CONSTRAINT "trade_executions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD CONSTRAINT "trade_executions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD CONSTRAINT "trade_executions_entry_order_id_orders_order_id_fk" FOREIGN KEY ("entry_order_id") REFERENCES "public"."orders"("order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD CONSTRAINT "trade_executions_exit_order_id_orders_order_id_fk" FOREIGN KEY ("exit_order_id") REFERENCES "public"."orders"("order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_profiles" ADD CONSTRAINT "trading_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_setups" ADD CONSTRAINT "trading_setups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_setups" ADD CONSTRAINT "trading_setups_order_id_orders_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "active_watchers_wallet_id_idx" ON "active_watchers" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "active_watchers_user_id_idx" ON "active_watchers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "active_watchers_profile_id_idx" ON "active_watchers" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "active_watchers_market_type_idx" ON "active_watchers" USING btree ("market_type");--> statement-breakpoint
CREATE INDEX "active_watchers_is_manual_idx" ON "active_watchers" USING btree ("is_manual");--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auto_trading_config_user_id_idx" ON "auto_trading_config" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auto_trading_config_wallet_id_idx" ON "auto_trading_config" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "indicator_history_type_time_idx" ON "indicator_history" USING btree ("indicator_type","recorded_at");--> statement-breakpoint
CREATE INDEX "indicator_history_recorded_at_idx" ON "indicator_history" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "idx_pair_maintenance_lookup" ON "pair_maintenance_log" USING btree ("symbol","interval","market_type");--> statement-breakpoint
CREATE INDEX "idx_last_gap_check" ON "pair_maintenance_log" USING btree ("last_gap_check");--> statement-breakpoint
CREATE INDEX "idx_last_corruption_check" ON "pair_maintenance_log" USING btree ("last_corruption_check");--> statement-breakpoint
CREATE INDEX "price_cache_timestamp_idx" ON "price_cache" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "setup_detections_user_id_idx" ON "setup_detections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "setup_detections_symbol_interval_idx" ON "setup_detections" USING btree ("symbol","interval");--> statement-breakpoint
CREATE INDEX "setup_detections_setup_type_idx" ON "setup_detections" USING btree ("setup_type");--> statement-breakpoint
CREATE INDEX "setup_detections_detected_at_idx" ON "setup_detections" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "setup_detections_expires_at_idx" ON "setup_detections" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "strategy_performance_lookup_idx" ON "strategy_performance" USING btree ("strategy_id","symbol","interval");--> statement-breakpoint
CREATE INDEX "strategy_performance_updated_idx" ON "strategy_performance" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "strategy_performance_win_rate_idx" ON "strategy_performance" USING btree ("win_rate");--> statement-breakpoint
CREATE UNIQUE INDEX "symbol_ts_override_wallet_symbol_idx" ON "symbol_trailing_stop_overrides" USING btree ("wallet_id","symbol");--> statement-breakpoint
CREATE INDEX "trade_cooldowns_lookup_idx" ON "trade_cooldowns" USING btree ("strategy_id","symbol","interval","wallet_id");--> statement-breakpoint
CREATE INDEX "trade_cooldowns_expiry_idx" ON "trade_cooldowns" USING btree ("cooldown_until");--> statement-breakpoint
CREATE INDEX "trade_cooldowns_wallet_idx" ON "trade_cooldowns" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "trade_executions_user_id_idx" ON "trade_executions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trade_executions_wallet_id_idx" ON "trade_executions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "trade_executions_status_idx" ON "trade_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trade_executions_opened_at_idx" ON "trade_executions" USING btree ("opened_at");--> statement-breakpoint
CREATE INDEX "trade_executions_setup_type_idx" ON "trade_executions" USING btree ("setup_type");--> statement-breakpoint
CREATE INDEX "trade_executions_market_type_idx" ON "trade_executions" USING btree ("market_type");--> statement-breakpoint
CREATE INDEX "trading_profiles_user_id_idx" ON "trading_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_preferences_user_id_category_idx" ON "user_preferences" USING btree ("user_id","category");