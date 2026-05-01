import { index, integer, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { wallets } from './wallets';

/**
 * Append-only audit trail for every MCP-connected agent that touches
 * the trading surface. Foundation table for C.1 — populated once the
 * write tools (place_order, cancel_order, close_position, set_sl_tp)
 * land. Read tools and the toggle UI write here too so the user can
 * see *every* agent action in Settings → Security → AI Agent
 * Activity. See docs/MCP_TRADING_CONCEPT.md.
 */
export const mcpTradingAudit = pgTable(
  'mcp_trading_audit',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    walletId: varchar('wallet_id', { length: 255 })
      .references(() => wallets.id, { onDelete: 'set null' }),
    tool: varchar('tool', { length: 64 }).notNull(),
    /** 'success' | 'failure' | 'denied' (toggle off) | 'rate_limited' */
    status: varchar('status', { length: 20 }).notNull(),
    inputJson: text('input_json'),
    resultJson: text('result_json'),
    errorMessage: text('error_message'),
    /** Optional client-supplied UUID for at-least-once → exactly-once semantics. */
    idempotencyKey: varchar('idempotency_key', { length: 255 }),
    /** Wall-clock ms the tool took, for rate-limit + perf observability. */
    durationMs: integer('duration_ms'),
    ts: timestamp('ts', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => ({
    userTsIdx: index('mcp_trading_audit_user_ts_idx').on(t.userId, t.ts),
    idempotencyIdx: index('mcp_trading_audit_idempotency_idx').on(t.userId, t.idempotencyKey),
  }),
);

export type McpTradingAudit = typeof mcpTradingAudit.$inferSelect;
export type NewMcpTradingAudit = typeof mcpTradingAudit.$inferInsert;
