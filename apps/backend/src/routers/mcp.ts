import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { mcpTradingAudit, wallets } from '../db/schema';
import { protectedProcedure, router } from '../trpc';
import { forbidden, notFound, tooManyRequests } from '../utils/trpc-errors';

const auditStatusSchema = z.enum(['success', 'failure', 'denied', 'rate_limited']);

export const MCP_WRITES_PER_HOUR = 30;
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * MCP-side endpoints. Owns:
 * - audit log writes from any MCP server (mcp-trading, future mcp-app
 *   write surfaces) so every agent action lands in one searchable
 *   table.
 * - audit log reads scoped to the calling user, used by the future
 *   "AI Agent Activity" panel in Settings → Security.
 *
 * Write tools land in follow-up PRs; this router is the foundation.
 */
export const mcpRouter = router({
  recordAudit: protectedProcedure
    .input(z.object({
      walletId: z.string().nullable().optional(),
      tool: z.string().min(1).max(64),
      status: auditStatusSchema,
      inputJson: z.string().nullable().optional(),
      resultJson: z.string().nullable().optional(),
      errorMessage: z.string().nullable().optional(),
      idempotencyKey: z.string().max(255).nullable().optional(),
      durationMs: z.number().int().nonnegative().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify wallet ownership when one is supplied — never let the
      // calling user log against a wallet they don't own.
      if (input.walletId) {
        const owned = await ctx.db.query.wallets.findFirst({
          where: and(
            eq(wallets.id, input.walletId),
            eq(wallets.userId, ctx.user.id),
          ),
        });
        if (!owned) {
          throw notFound('Wallet');
        }
      }

      // Idempotency: if the same (user, key) was already logged, return
      // the existing row instead of inserting a duplicate. Lets agents
      // safely retry transient failures without polluting the trail.
      if (input.idempotencyKey) {
        const existing = await ctx.db.query.mcpTradingAudit.findFirst({
          where: and(
            eq(mcpTradingAudit.userId, ctx.user.id),
            eq(mcpTradingAudit.idempotencyKey, input.idempotencyKey),
          ),
        });
        if (existing) {
          return { id: existing.id, deduped: true as const };
        }
      }

      const [row] = await ctx.db.insert(mcpTradingAudit).values({
        userId: ctx.user.id,
        walletId: input.walletId ?? null,
        tool: input.tool,
        status: input.status,
        inputJson: input.inputJson ?? null,
        resultJson: input.resultJson ?? null,
        errorMessage: input.errorMessage ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        durationMs: input.durationMs ?? null,
      }).returning({ id: mcpTradingAudit.id });

      return { id: row!.id, deduped: false as const };
    }),

  /**
   * Hard-gate for MCP write tools. Every write tool in
   * @marketmind/mcp-trading must call this before touching the
   * exchange — when wallet.agentTradingEnabled is false, this throws
   * FORBIDDEN and writes a `denied` audit row so the user can see the
   * blocked attempt in Settings → Security → AI Agent Activity. The
   * accident-prevention gate the user explicitly asked for: an MCP
   * client cannot place an order on a wallet whose toggle is off.
   */
  assertWriteAllowed: protectedProcedure
    .input(z.object({
      walletId: z.string(),
      tool: z.string().min(1).max(64),
    }))
    .mutation(async ({ ctx, input }) => {
      const wallet = await ctx.db.query.wallets.findFirst({
        where: and(eq(wallets.id, input.walletId), eq(wallets.userId, ctx.user.id)),
      });
      if (!wallet) {
        throw notFound('Wallet');
      }
      if (!wallet.agentTradingEnabled) {
        await ctx.db.insert(mcpTradingAudit).values({
          userId: ctx.user.id,
          walletId: wallet.id,
          tool: input.tool,
          status: 'denied',
          errorMessage: 'agent trading is disabled for this wallet',
        });
        throw forbidden('agent trading is disabled for this wallet');
      }

      // Rate limit: at most MCP_WRITES_PER_HOUR successful writes in
      // the last hour, scoped to (user, wallet). Counts only 'success'
      // rows so a flurry of failures doesn't lock the wallet out.
      // When exceeded, throw TOO_MANY_REQUESTS and write a
      // 'rate_limited' audit row so the user can see in Settings →
      // Security → AI Agent Activity that the throttle fired.
      const since = new Date(Date.now() - ONE_HOUR_MS);
      const counts = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(mcpTradingAudit)
        .where(and(
          eq(mcpTradingAudit.userId, ctx.user.id),
          eq(mcpTradingAudit.walletId, wallet.id),
          eq(mcpTradingAudit.status, 'success'),
          gte(mcpTradingAudit.ts, since),
        ));
      const recentSuccessCount = counts[0]?.count ?? 0;
      if (recentSuccessCount >= MCP_WRITES_PER_HOUR) {
        await ctx.db.insert(mcpTradingAudit).values({
          userId: ctx.user.id,
          walletId: wallet.id,
          tool: input.tool,
          status: 'rate_limited',
          errorMessage: `rate limit exceeded (${MCP_WRITES_PER_HOUR}/hour)`,
        });
        throw tooManyRequests(
          `rate limit exceeded (${MCP_WRITES_PER_HOUR}/hour for this wallet); try again later`,
        );
      }

      return { ok: true as const };
    }),

  listAudit: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(500).default(100),
      walletId: z.string().nullable().optional(),
    }).default({ limit: 100 }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(mcpTradingAudit.userId, ctx.user.id)];
      if (input.walletId) conditions.push(eq(mcpTradingAudit.walletId, input.walletId));

      const rows = await ctx.db
        .select({
          id: mcpTradingAudit.id,
          walletId: mcpTradingAudit.walletId,
          tool: mcpTradingAudit.tool,
          status: mcpTradingAudit.status,
          errorMessage: mcpTradingAudit.errorMessage,
          idempotencyKey: mcpTradingAudit.idempotencyKey,
          durationMs: mcpTradingAudit.durationMs,
          ts: mcpTradingAudit.ts,
        })
        .from(mcpTradingAudit)
        .where(and(...conditions))
        .orderBy(desc(mcpTradingAudit.ts))
        .limit(input.limit);

      return rows;
    }),
});
