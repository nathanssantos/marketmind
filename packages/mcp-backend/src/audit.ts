import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const AUDIT_LOG_PATH = process.env.MM_MCP_AUDIT_LOG_PATH ?? path.resolve('apps/backend/logs/mcp-audit.jsonl');

interface AuditEntry {
  ts: string;
  event: string;
  tool?: string;
  args?: unknown;
  result?: 'ok' | 'error';
  durationMs?: number;
  message?: string;
}

const ensureDir = async (filepath: string): Promise<void> => {
  const dir = path.dirname(filepath);
  await mkdir(dir, { recursive: true });
};

export const writeAudit = async (entry: Omit<AuditEntry, 'ts'>): Promise<void> => {
  await ensureDir(AUDIT_LOG_PATH);
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
  await appendFile(AUDIT_LOG_PATH, line, 'utf8');
};

export const tailAudit = async (opts: { event?: string; since?: string; limit?: number }): Promise<AuditEntry[]> => {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  let raw: string;
  try {
    raw = await readFile(AUDIT_LOG_PATH, 'utf8');
  } catch {
    return [];
  }
  const lines = raw.trim().split('\n').filter(Boolean);
  const entries: AuditEntry[] = [];
  const sinceTs = opts.since ? new Date(opts.since).toISOString() : undefined;
  for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
    try {
      const entry = JSON.parse(lines[i]!) as AuditEntry;
      if (opts.event && entry.event !== opts.event) continue;
      if (sinceTs && entry.ts < sinceTs) continue;
      entries.push(entry);
    } catch { /* skip malformed lines */ }
  }
  return entries.reverse();
};

export const getAuditPath = (): string => AUDIT_LOG_PATH;
