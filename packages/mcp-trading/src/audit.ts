import { callProcedure } from './trpc.js';

export type AuditStatus = 'success' | 'failure' | 'denied' | 'rate_limited';

/**
 * Hard-gate every write tool calls before touching the exchange. The
 * backend checks `wallet.agentTradingEnabled === true` and throws
 * FORBIDDEN (also writing a `denied` audit row) when the toggle is
 * off. Read tools never call this. Write-tool authors: invoke this
 * BEFORE the audited(...) wrapper so a denied call doesn't end up
 * looking like a normal failure.
 */
export const assertWriteAllowed = async (walletId: string, tool: string): Promise<void> => {
  await callProcedure('mcp.assertWriteAllowed', { walletId, tool });
};

export interface AuditOptions {
  walletId?: string | null;
  inputJson?: string | null;
  resultJson?: string | null;
  errorMessage?: string | null;
  idempotencyKey?: string | null;
  durationMs?: number | null;
}

/**
 * Wraps an MCP tool handler with audit logging. Records one row per
 * invocation via the backend mcp.recordAudit endpoint — success rows
 * include resultJson, failure rows include the error message.
 *
 * Errors from recordAudit itself are logged to stderr but never
 * propagated; the tool's result is the source of truth for the caller.
 */
export const audited = async <T>(
  tool: string,
  options: AuditOptions,
  fn: () => Promise<T>,
): Promise<T> => {
  const started = Date.now();
  try {
    const result = await fn();
    void recordAuditSafe({
      tool,
      status: 'success',
      walletId: options.walletId ?? null,
      inputJson: options.inputJson ?? null,
      resultJson: typeof result === 'string' ? result : (() => {
        try { return JSON.stringify(result); } catch { return null; }
      })(),
      idempotencyKey: options.idempotencyKey ?? null,
      durationMs: Date.now() - started,
    });
    return result;
  } catch (err) {
    void recordAuditSafe({
      tool,
      status: 'failure',
      walletId: options.walletId ?? null,
      inputJson: options.inputJson ?? null,
      errorMessage: err instanceof Error ? err.message : String(err),
      idempotencyKey: options.idempotencyKey ?? null,
      durationMs: Date.now() - started,
    });
    throw err;
  }
};

interface RecordAuditPayload {
  tool: string;
  status: AuditStatus;
  walletId: string | null;
  inputJson: string | null;
  resultJson?: string | null;
  errorMessage?: string | null;
  idempotencyKey: string | null;
  durationMs: number;
}

const recordAuditSafe = async (payload: RecordAuditPayload): Promise<void> => {
  try {
    await callProcedure('mcp.recordAudit', payload);
  } catch (err) {
    process.stderr.write(`[mcp-trading] failed to write audit row: ${err instanceof Error ? err.message : String(err)}\n`);
  }
};
