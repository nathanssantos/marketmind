import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';

/**
 * Dedicated structured logger for raw Binance WebSocket events + handler
 * dispatches. Purpose: post-incident replay. When the user reports "Today's
 * P&L didn't update" or "the reverse didn't sync," we need to be able to
 * grep this file and see the exact sequence of events that arrived from
 * Binance and what each handler did — without scrolling through tens of
 * thousands of unrelated info-level renderer/router lines.
 *
 * Format: JSON lines (one JSON object per line) written to
 *   `apps/backend/logs/binance-events/YYYY-MM-DD.log`
 *
 * One file per UTC day so rotation is implicit and `grep` / `jq` over a
 * recent window stays fast.
 *
 * The logger is silent in tests (NODE_ENV=test or VITEST=true).
 */

const isTest = process.env['NODE_ENV'] === 'test' || process.env['VITEST'] === 'true';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(currentDir, '../../logs/binance-events');

const ensureLogDir = (): void => {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
};

const todayFilename = (): string => {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return path.join(LOG_DIR, `${y}-${m}-${day}.log`);
};

let cachedLogger: pino.Logger | null = null;
let cachedFile: string | null = null;

const getLogger = (): pino.Logger => {
  if (isTest) {
    if (!cachedLogger) cachedLogger = pino({ level: 'silent' });
    return cachedLogger;
  }
  const file = todayFilename();
  if (cachedLogger && cachedFile === file) return cachedLogger;
  ensureLogDir();
  cachedFile = file;
  cachedLogger = pino(
    {
      level: 'trace',
      base: undefined,
      formatters: {
        level: (label) => ({ level: label }),
      },
    },
    pino.destination({
      dest: file,
      sync: false,
      mkdir: true,
    }),
  );
  return cachedLogger;
};

const MAX_RAW_LENGTH = 2000;

const truncateRaw = (payload: unknown): unknown => {
  try {
    const s = JSON.stringify(payload);
    if (s.length <= MAX_RAW_LENGTH) return payload;
    return `${s.slice(0, MAX_RAW_LENGTH)}... [truncated, ${s.length} chars]`;
  } catch {
    return '[unserializable]';
  }
};

/**
 * Raw Binance event arrived on the WS — log it before any handler runs.
 * `ws` is the Binance stream key ('usdm', 'usdmTestnet', 'spot', etc.).
 */
export const logBinanceEvent = (
  walletId: string,
  ws: string,
  raw: unknown,
): void => {
  const eventType = (raw as { e?: string } | null)?.e ?? 'unknown';
  getLogger().info(
    {
      kind: 'ws-event',
      walletId,
      ws,
      eventType,
      raw: truncateRaw(raw),
    },
    'binance-event',
  );
};

export interface HandlerLogPayload {
  handler: string;
  walletId: string;
  executionId?: string;
  orderId?: string | number;
  action: string;
  latencyMs?: number;
  /** Free-form extra context — kept small so the line stays grep-friendly. */
  extra?: Record<string, unknown>;
}

/**
 * Handler dispatch checkpoint — call from each user-stream handler at
 * meaningful actions (broadcast emitted, DB row written, income inserted,
 * etc.). Keeps a queryable trail of "what the handler actually did" for
 * each incoming event.
 */
export const logHandlerAction = (payload: HandlerLogPayload): void => {
  getLogger().info({ kind: 'handler', ...payload }, 'binance-handler');
};

/**
 * Handler error — captured separately so `grep '"level":"error"'` over
 * the daily file surfaces every failure path.
 */
export const logHandlerError = (
  handler: string,
  walletId: string,
  error: unknown,
  extra?: Record<string, unknown>,
): void => {
  const message = error instanceof Error ? error.message : String(error);
  getLogger().error(
    { kind: 'handler-error', handler, walletId, error: message, extra },
    'binance-handler-error',
  );
};
