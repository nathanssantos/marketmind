#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import {
  getBacktestResult,
  getTrpcUrl,
  listBacktests,
  runBacktest,
  type BacktestRunInput,
} from './backtest.js';
import {
  createUserStrategy,
  exportStrategy,
  getStrategyDirs,
  listStrategies,
} from './strategies.js';

const tools: Tool[] = [
  {
    name: 'strategy.list',
    description:
      'List every available Pine strategy (builtin + user). Returns header metadata only — use `strategy.export` for the full source.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'strategy.export',
    description: 'Read the full Pine source for a single strategy by id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'strategy.create',
    description:
      'Write a new Pine strategy to the user strategies directory. Validates the header (`// @id`, `// @name`, `//@version=5`).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'lowercase + digits + hyphens; must match `// @id` header' },
        pine: { type: 'string', description: 'Full Pine source' },
        overwrite: { type: 'boolean', default: false },
      },
      required: ['id', 'pine'],
    },
  },
  {
    name: 'strategy.run',
    description:
      'Run a backtest for a strategy via the running backend (`backtest.run` tRPC). Returns the BacktestResult shape.',
    inputSchema: {
      type: 'object',
      properties: {
        strategyId: { type: 'string' },
        symbol: { type: 'string' },
        interval: { type: 'string', description: 'e.g. "1m", "5m", "1h", "1d"' },
        startTime: { type: 'string', description: 'ISO date' },
        endTime: { type: 'string', description: 'ISO date' },
        initialBalance: { type: 'number', default: 10000 },
        exchange: { type: 'string', enum: ['BINANCE', 'INTERACTIVE_BROKERS'] },
        assetClass: { type: 'string', enum: ['CRYPTO', 'STOCKS'] },
        params: { type: 'object', additionalProperties: true },
      },
      required: ['strategyId', 'symbol', 'interval', 'startTime', 'endTime'],
    },
  },
  {
    name: 'strategy.diff',
    description:
      'Run two backtests of the same strategy with different params and return both results plus a metric comparison.',
    inputSchema: {
      type: 'object',
      properties: {
        strategyId: { type: 'string' },
        fixture: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            interval: { type: 'string' },
            startTime: { type: 'string' },
            endTime: { type: 'string' },
            initialBalance: { type: 'number' },
            exchange: { type: 'string' },
            assetClass: { type: 'string' },
          },
          required: ['symbol', 'interval', 'startTime', 'endTime'],
        },
        paramsA: { type: 'object', additionalProperties: true },
        paramsB: { type: 'object', additionalProperties: true },
      },
      required: ['strategyId', 'fixture', 'paramsA', 'paramsB'],
    },
  },
  {
    name: 'strategy.getResult',
    description: 'Fetch a previous backtest result by id (proxies `backtest.getResult`).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'strategy.listBacktests',
    description: 'List recent backtests (proxies `backtest.list`).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: '__health',
    description: 'Server heartbeat. Returns dirs + tRPC URL.',
    inputSchema: { type: 'object', properties: {} },
  },
];

interface ToolArgs {
  id?: string;
  pine?: string;
  overwrite?: boolean;
  strategyId?: string;
  symbol?: string;
  interval?: string;
  startTime?: string;
  endTime?: string;
  initialBalance?: number;
  exchange?: 'BINANCE' | 'INTERACTIVE_BROKERS';
  assetClass?: 'CRYPTO' | 'STOCKS';
  params?: Record<string, unknown>;
  paramsA?: Record<string, unknown>;
  paramsB?: Record<string, unknown>;
  fixture?: BacktestRunInput;
}

const ok = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

const fail = (message: string) => ({
  content: [{ type: 'text' as const, text: message }],
  isError: true,
});

const requireField = <K extends keyof ToolArgs>(args: ToolArgs, key: K): NonNullable<ToolArgs[K]> => {
  const v = args[key];
  if (v === undefined || v === null) throw new Error(`'${String(key)}' is required`);
  return v as NonNullable<ToolArgs[K]>;
};

const summarizeMetrics = (result: unknown): Record<string, number | string> => {
  const r = result as { metrics?: Record<string, unknown>; summary?: Record<string, unknown> } | null;
  const src = r?.metrics ?? r?.summary ?? {};
  const out: Record<string, number | string> = {};
  for (const [key, val] of Object.entries(src)) {
    if (typeof val === 'number' || typeof val === 'string') out[key] = val;
  }
  return out;
};

const handleTool = async (name: string, rawArgs: unknown) => {
  const args = (rawArgs ?? {}) as ToolArgs;
  switch (name) {
    case 'strategy.list':
      return ok(await listStrategies());
    case 'strategy.export':
      return ok(await exportStrategy(requireField(args, 'id')));
    case 'strategy.create':
      return ok(await createUserStrategy(
        requireField(args, 'id'),
        requireField(args, 'pine'),
        args.overwrite ?? false,
      ));
    case 'strategy.run': {
      const input: BacktestRunInput = {
        strategyId: requireField(args, 'strategyId'),
        symbol: requireField(args, 'symbol'),
        interval: requireField(args, 'interval'),
        startTime: requireField(args, 'startTime'),
        endTime: requireField(args, 'endTime'),
        initialBalance: args.initialBalance,
        exchange: args.exchange,
        assetClass: args.assetClass,
        params: args.params,
      };
      return ok(await runBacktest(input));
    }
    case 'strategy.diff': {
      const strategyId = requireField(args, 'strategyId');
      const fixture = requireField(args, 'fixture');
      const paramsA = requireField(args, 'paramsA');
      const paramsB = requireField(args, 'paramsB');
      const [a, b] = await Promise.all([
        runBacktest({ ...fixture, strategyId, params: paramsA }),
        runBacktest({ ...fixture, strategyId, params: paramsB }),
      ]);
      return ok({
        a: { params: paramsA, metrics: summarizeMetrics(a), result: a },
        b: { params: paramsB, metrics: summarizeMetrics(b), result: b },
      });
    }
    case 'strategy.getResult':
      return ok(await getBacktestResult(requireField(args, 'id')));
    case 'strategy.listBacktests':
      return ok(await listBacktests());
    case '__health':
      return ok({
        ok: true,
        trpcUrl: getTrpcUrl(),
        dirs: getStrategyDirs(),
        tools: tools.length,
      });
    default:
      return fail(`Unknown tool: ${name}`);
  }
};

const main = async () => {
  const server = new Server(
    { name: '@marketmind/mcp-strategy', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      return await handleTool(name, args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(`Tool '${name}' failed: ${message}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
};

main().catch((err) => {
  console.error('[mcp-strategy] fatal:', err);
  process.exit(1);
});
