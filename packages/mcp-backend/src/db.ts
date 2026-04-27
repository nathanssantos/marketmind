import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? process.env.MM_MCP_DATABASE_URL,
  max: 4,
  application_name: 'mcp-backend',
  statement_timeout: 15_000,
});

/**
 * Tables exposed via the MCP query layer. Adding a table here is the only way
 * for an agent to read it via the typed `db.query.{table}` tools.
 */
export const TABLE_ALLOWLIST = {
  wallets: 'wallets',
  executions: 'trade_executions',
  orders: 'orders',
  klines: 'klines',
  users: 'users',
  sessions: 'sessions',
  watchers: 'active_watchers',
  setups: 'setup_detections',
  autoTradingConfig: 'auto_trading_config',
} as const;

export type TableId = keyof typeof TABLE_ALLOWLIST;

interface QueryOptions {
  where?: Record<string, string | number | boolean | null>;
  since?: string;       // ISO date — applied to created_at if column exists
  sinceColumn?: string; // override default since-column
  limit?: number;       // default 100, max 1000
  orderBy?: string;     // default `created_at desc` if exists, else id
}

const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/i;
const checkIdent = (s: string): string => {
  if (!SAFE_IDENT.test(s)) throw new Error(`unsafe identifier: ${s}`);
  return s;
};

const buildSelect = (table: string, opts: QueryOptions): { sql: string; values: unknown[] } => {
  checkIdent(table);
  const where: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (opts.where) {
    for (const [col, val] of Object.entries(opts.where)) {
      checkIdent(col);
      if (val === null) {
        where.push(`${col} IS NULL`);
      } else {
        where.push(`${col} = $${idx++}`);
        values.push(val);
      }
    }
  }

  if (opts.since) {
    const col = checkIdent(opts.sinceColumn ?? 'created_at');
    where.push(`${col} >= $${idx++}`);
    values.push(new Date(opts.since));
  }

  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 1_000);
  const orderBy = opts.orderBy ? checkIdent(opts.orderBy.split(' ')[0] ?? '') + (opts.orderBy.toLowerCase().includes(' asc') ? ' ASC' : ' DESC') : '';
  const orderClause = orderBy ? `ORDER BY ${orderBy}` : '';
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const sql = `SELECT * FROM ${table} ${whereClause} ${orderClause} LIMIT ${limit}`;
  return { sql, values };
};

export const queryTable = async (
  tableId: TableId,
  opts: QueryOptions = {},
): Promise<{ rows: Record<string, unknown>[]; count: number }> => {
  const tableName = TABLE_ALLOWLIST[tableId];
  if (!tableName) throw new Error(`unknown table id: ${tableId}`);
  const { sql, values } = buildSelect(tableName, opts);
  const result = await pool.query(sql, values);
  return { rows: result.rows, count: result.rowCount ?? result.rows.length };
};

const FORBIDDEN_TOKENS = [
  /\binsert\b/i, /\bupdate\b/i, /\bdelete\b/i, /\bdrop\b/i, /\btruncate\b/i,
  /\balter\b/i, /\bgrant\b/i, /\brevoke\b/i, /\bcreate\b/i, /\bcopy\b/i,
  /\bvacuum\b/i, /\bset\b/i, /\bdiscard\b/i, /\blisten\b/i, /\bnotify\b/i,
  /\b;\s*\w+/i, // multiple statements
];

export const execReadOnly = async (sql: string): Promise<{ rows: Record<string, unknown>[]; count: number }> => {
  const trimmed = sql.trim();
  if (!/^select\b|^with\b/i.test(trimmed)) {
    throw new Error('only SELECT/CTE statements are allowed');
  }
  for (const pattern of FORBIDDEN_TOKENS) {
    if (pattern.test(trimmed)) throw new Error(`forbidden token in SQL: ${pattern.source}`);
  }
  const result = await pool.query(trimmed);
  return { rows: result.rows, count: result.rowCount ?? result.rows.length };
};

export const ping = async (): Promise<boolean> => {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
};

export const closePool = async (): Promise<void> => {
  await pool.end();
};
