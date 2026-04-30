#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { audited } from './audit.js';
import { callProcedure, getTrpcBaseUrl, trpcHealthCheck } from './trpc.js';

const tools: Tool[] = [
  {
    name: 'trading.list_orders',
    description: 'List spot/futures orders for a wallet (open + recent history). Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        walletId: { type: 'string', description: 'The wallet to query.' },
        marketType: { type: 'string', enum: ['SPOT', 'FUTURES'], description: 'Defaults to FUTURES.' },
        symbol: { type: 'string', description: 'Optional symbol filter (e.g. BTCUSDT).' },
        limit: { type: 'number', default: 50, minimum: 1, maximum: 500 },
      },
      required: ['walletId'],
    },
  },
  {
    name: 'trading.list_positions',
    description: 'List open futures positions for a wallet. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        walletId: { type: 'string', description: 'The wallet to query.' },
      },
      required: ['walletId'],
    },
  },
  {
    name: 'trading.list_executions',
    description: 'List trade executions (closed + open trades managed by the auto-trading layer). Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        walletId: { type: 'string', description: 'The wallet to query.' },
        symbol: { type: 'string' },
        status: { type: 'string', enum: ['open', 'closed', 'pending'] },
        limit: { type: 'number', default: 100, minimum: 1, maximum: 500 },
      },
      required: ['walletId'],
    },
  },
  {
    name: 'trading.get_wallet_status',
    description: 'Wallet metadata + balances. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        walletId: { type: 'string' },
      },
      required: ['walletId'],
    },
  },
  {
    name: 'health.check',
    description: 'Confirm the backend tRPC endpoint is reachable.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: '__health',
    description: 'Lightweight heartbeat for the MCP server itself.',
    inputSchema: { type: 'object', properties: {} },
  },
];

interface ListOrdersArgs { walletId: string; marketType?: 'SPOT' | 'FUTURES'; symbol?: string; limit?: number }
interface ListPositionsArgs { walletId: string }
interface ListExecutionsArgs { walletId: string; symbol?: string; status?: 'open' | 'closed' | 'pending'; limit?: number }
interface GetWalletStatusArgs { walletId: string }

const handle = async (name: string, args: Record<string, unknown> | undefined): Promise<unknown> => {
  switch (name) {
    case 'trading.list_orders': {
      const a = (args ?? {}) as unknown as ListOrdersArgs;
      return audited(name, { walletId: a.walletId, inputJson: JSON.stringify(a) }, async () => {
        const marketType = a.marketType ?? 'FUTURES';
        if (marketType === 'FUTURES') {
          return await callProcedure('futuresTrading.getOpenOrders', { walletId: a.walletId, ...(a.symbol ? { symbol: a.symbol } : {}) });
        }
        return await callProcedure('trading.getOrders', { walletId: a.walletId, ...(a.symbol ? { symbol: a.symbol } : {}), limit: a.limit ?? 50 });
      });
    }
    case 'trading.list_positions': {
      const a = (args ?? {}) as unknown as ListPositionsArgs;
      return audited(name, { walletId: a.walletId, inputJson: JSON.stringify(a) }, () =>
        callProcedure('futuresTrading.getPositions', { walletId: a.walletId }),
      );
    }
    case 'trading.list_executions': {
      const a = (args ?? {}) as unknown as ListExecutionsArgs;
      return audited(name, { walletId: a.walletId, inputJson: JSON.stringify(a) }, () =>
        callProcedure('trading.getTradeExecutions', {
          walletId: a.walletId,
          ...(a.symbol ? { symbol: a.symbol } : {}),
          ...(a.status ? { status: a.status } : {}),
          limit: a.limit ?? 100,
        }),
      );
    }
    case 'trading.get_wallet_status': {
      const a = (args ?? {}) as unknown as GetWalletStatusArgs;
      return audited(name, { walletId: a.walletId, inputJson: JSON.stringify(a) }, () =>
        callProcedure('wallet.getById', { id: a.walletId }),
      );
    }
    case 'health.check': {
      const trpc = await trpcHealthCheck();
      return {
        trpc: { ok: trpc.ok, status: trpc.status, baseUrl: trpc.baseUrl },
        sessionCookie: process.env.MM_MCP_SESSION_COOKIE ? 'set' : 'unset',
      };
    }
    case '__health':
      return { ok: true, baseUrl: getTrpcBaseUrl() };
    default:
      throw new Error(`unknown tool: ${name}`);
  }
};

const main = async () => {
  const server = new Server(
    { name: 'mm-mcp-trading', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name;
    const args = req.params.arguments;
    try {
      const result = await handle(name, args);
      return {
        content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
};

main().catch((err) => {
  process.stderr.write(`mm-mcp-trading fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
