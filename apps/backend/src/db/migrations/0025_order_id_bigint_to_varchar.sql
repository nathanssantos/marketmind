-- Drop foreign keys first
ALTER TABLE "trading_setups" DROP CONSTRAINT IF EXISTS "trading_setups_order_id_orders_order_id_fk";
ALTER TABLE "trade_executions" DROP CONSTRAINT IF EXISTS "trade_executions_entry_order_id_orders_order_id_fk";
ALTER TABLE "trade_executions" DROP CONSTRAINT IF EXISTS "trade_executions_exit_order_id_orders_order_id_fk";

-- Convert orders.order_id from bigint to varchar
ALTER TABLE "orders" ALTER COLUMN "order_id" TYPE varchar(40) USING order_id::varchar;

-- Convert trading_setups.order_id
ALTER TABLE "trading_setups" ALTER COLUMN "order_id" TYPE varchar(40) USING order_id::varchar;

-- Convert trade_executions order ID columns
ALTER TABLE "trade_executions" ALTER COLUMN "entry_order_id" TYPE varchar(40) USING entry_order_id::varchar;
ALTER TABLE "trade_executions" ALTER COLUMN "stop_loss_order_id" TYPE varchar(40) USING stop_loss_order_id::varchar;
ALTER TABLE "trade_executions" ALTER COLUMN "take_profit_order_id" TYPE varchar(40) USING take_profit_order_id::varchar;
ALTER TABLE "trade_executions" ALTER COLUMN "order_list_id" TYPE varchar(40) USING order_list_id::varchar;
ALTER TABLE "trade_executions" ALTER COLUMN "exit_order_id" TYPE varchar(40) USING exit_order_id::varchar;
ALTER TABLE "trade_executions" ALTER COLUMN "trailing_stop_algo_id" TYPE varchar(40) USING trailing_stop_algo_id::varchar;
ALTER TABLE "trade_executions" ALTER COLUMN "stop_loss_algo_id" TYPE varchar(40) USING stop_loss_algo_id::varchar;
ALTER TABLE "trade_executions" ALTER COLUMN "take_profit_algo_id" TYPE varchar(40) USING take_profit_algo_id::varchar;

-- Recreate foreign keys
ALTER TABLE "trading_setups" ADD CONSTRAINT "trading_setups_order_id_orders_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id");
ALTER TABLE "trade_executions" ADD CONSTRAINT "trade_executions_entry_order_id_orders_order_id_fk" FOREIGN KEY ("entry_order_id") REFERENCES "orders"("order_id");
ALTER TABLE "trade_executions" ADD CONSTRAINT "trade_executions_exit_order_id_orders_order_id_fk" FOREIGN KEY ("exit_order_id") REFERENCES "orders"("order_id");
