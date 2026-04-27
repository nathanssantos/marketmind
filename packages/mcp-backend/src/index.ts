#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { getAuditPath, tailAudit, writeAudit } from './audit.js';
import { closePool, execReadOnly, ping, queryTable, TABLE_ALLOWLIST, type TableId } from './db.js';
import { callProcedure, getTrpcBaseUrl, trpcHealthCheck } from './trpc.js';

const TABLE_IDS = Object.keys(TABLE_ALLOWLIST) as TableId[];

const queryToolFor = (tableId: TableId): Tool => ({
  name: `db.query.${tableId}`,
  description: `Read rows from the \`${TABLE_ALLOWLIST[tableId]}\` table. Read-only.`,
  inputSchema: {
    type: 'object',
    properties: {
      where: {
        type: 'object',
        additionalProperties: { type: ['string', 'number', 'boolean', 'null'] },
        description: 'Equality filters keyed by column name.',
      },
      since: {
        type: 'string',
        description: 'ISO date — applied to created_at unless `sinceColumn` is given.',
      },
      sinceColumn: { type: 'string' },
      limit: { type: 'number', default: 100, minimum: 1, maximum: 1000 },
      orderBy: { type: 'string', description: 'Single column. Suffix " asc" or " desc" (default desc).' },
    },
  },
});

const tools: Tool[] = [
  ...TABLE_IDS.map(queryToolFor),
  {
    name: 'db.exec',
    description:
      'Run an arbitrary SELECT/CTE statement. Multi-statement, INSERT/UPDATE/DELETE/DDL, SET, NOTIFY, COPY, etc. are all rejected.',
    inputSchema: {
      type: 'object',
      properties: { sql: { type: 'string' } },
      required: ['sql'],
    },
  },
  {
    name: 'trpc.call',
    description:
      'Invoke a tRPC procedure on the running backend (uses MM_MCP_SESSION_COOKIE for auth). Read/idempotent calls only.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Dotted procedure path, e.g. `wallet.list`.' },
        input: {},
      },
      required: ['path'],
    },
  },
  {
    name: 'audit.tail',
    description: 'Read recent MCP audit log entries (most recent first, default 50).',
    inputSchema: {
      type: 'object',
      properties: {
        event: { type: 'string' },
        since: { type: 'string', description: 'ISO date.' },
        limit: { type: 'number', default: 50, minimum: 1, maximum: 500 },
      },
    },
  },
  {
    name: 'health.check',
    description: 'Check DB + tRPC connectivity. Returns per-component status.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: '__health',
    description: 'Lightweight heartbeat — confirms the server itself is alive.',
    inputSchema: { type: 'object', properties: {} },
  },
];

interface QueryArgs {
  where?: Record<string, string | number | boolean | null>;
  since?: string;
  sinceColumn?: string;
  limit?: number;
  orderBy?: string;
}

const ok = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

const fail = (message: string) => ({
  content: [{ type: 'text' as const, text: message }],
  isError: true,
});

const handleTool = async (name: string, rawArgs: unknown) => {
  const args = (rawArgs ?? {}) as Record<string, unknown>;
  const start = Date.now();

  if (name.startsWith('db.query.')) {
    const tableId = name.slice('db.query.'.length) as TableId;
    if (!(tableId in TABLE_ALLOWLIST)) return fail(`unknown table: ${tableId}`);
    const result = await queryTable(tableId, args as QueryArgs);
    await writeAudit({ event: 'db.query', tool: name, args, result: 'ok', durationMs: Date.now() - start });
    return ok(result);
  }

  switch (name) {
    case 'db.exec': {
      const sql = args.sql as string;
      if (!sql) return fail('sql is required');
      const result = await execReadOnly(sql);
      await writeAudit({ event: 'db.exec', tool: name, args: { sql: sql.slice(0, 200) }, result: 'ok', durationMs: Date.now() - start });
      return ok(result);
    }
    case 'trpc.call': {
      const path = args.path as string;
      if (!path) return fail('path is required');
      const data = await callProcedure(path, args.input);
      await writeAudit({ event: 'trpc.call', tool: name, args: { path }, result: 'ok', durationMs: Date.now() - start });
      return ok(data);
    }
    case 'audit.tail':
      return ok(await tailAudit(args as { event?: string; since?: string; limit?: number }));
    case 'health.check': {
      const [db, trpc] = await Promise.all([ping(), trpcHealthCheck()]);
      return ok({
        db: { ok: db },
        trpc: { ok: trpc.ok, status: trpc.status, baseUrl: trpc.baseUrl },
        auditLog: getAuditPath(),
      });
    }
    case '__health':
      return ok({ ok: true, baseUrl: getTrpcBaseUrl(), tools: tools.length });
    default:
      return fail(`Unknown tool: ${name}`);
  }
};

const main = async () => {
  const server = new Server(
    { name: '@marketmind/mcp-backend', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      return await handleTool(name, args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await writeAudit({ event: 'error', tool: name, message, result: 'error' }).catch(() => undefined);
      return fail(`Tool '${name}' failed: ${message}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async () => {
    await closePool();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

main().catch(async (err) => {
  console.error('[mcp-backend] fatal:', err);
  process.exit(1);
});
