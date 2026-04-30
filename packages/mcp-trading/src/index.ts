#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { assertWriteAllowed, audited } from './audit.js';
import { callProcedure, getTrpcBaseUrl, trpcHealthCheck } from './trpc.js';

interface WalletStatus { id: string; walletType?: string | null; name?: string | null }

const assertPaperWallet = async (walletId: string, tool: string): Promise<void> => {
  const wallet = (await callProcedure('wallet.getById', { id: walletId })) as WalletStatus;
  if (wallet.walletType !== 'paper') {
    throw new Error(
      `${tool} is paper-only in this version of mm-mcp-trading. Wallet "${wallet.name ?? walletId}" is "${wallet.walletType}". Live trading via MCP lands in a follow-up release.`,
    );
  }
};

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
    name: 'trading.place_order',
    description: 'Place an order on a paper wallet. Gated by per-wallet agentTradingEnabled toggle in Settings → Security; throws FORBIDDEN if disabled. This version is paper-only — live wallets are blocked client-side.',
    inputSchema: {
      type: 'object',
      properties: {
        walletId: { type: 'string' },
        symbol: { type: 'string', description: 'e.g. BTCUSDT' },
        side: { type: 'string', enum: ['BUY', 'SELL'] },
        type: {
          type: 'string',
          enum: ['LIMIT', 'MARKET', 'STOP_LOSS', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT', 'TAKE_PROFIT_LIMIT', 'STOP_MARKET', 'TAKE_PROFIT_MARKET'],
        },
        quantity: { type: 'string', description: 'Base asset quantity. Provide either quantity or percent.' },
        percent: { type: 'number', minimum: 0.01, maximum: 100, description: 'Position size as % of balance. Requires referencePrice (or price/stopPrice).' },
        referencePrice: { type: 'number' },
        price: { type: 'string' },
        stopPrice: { type: 'string' },
        marketType: { type: 'string', enum: ['SPOT', 'FUTURES'], default: 'FUTURES' },
        reduceOnly: { type: 'boolean' },
        idempotencyKey: { type: 'string', description: 'UUID; duplicate keys return the prior result without re-executing.' },
      },
      required: ['walletId', 'symbol', 'side', 'type'],
    },
  },
  {
    name: 'trading.cancel_order',
    description: 'Cancel an open order on a paper wallet. Gated by agentTradingEnabled.',
    inputSchema: {
      type: 'object',
      properties: {
        walletId: { type: 'string' },
        symbol: { type: 'string' },
        orderId: { type: 'string' },
        marketType: { type: 'string', enum: ['SPOT', 'FUTURES'], default: 'FUTURES' },
        idempotencyKey: { type: 'string' },
      },
      required: ['walletId', 'symbol', 'orderId'],
    },
  },
  {
    name: 'trading.close_position',
    description: 'Close an open position on a paper wallet. Gated by agentTradingEnabled. Provide walletId so the gate can run before fetching the position.',
    inputSchema: {
      type: 'object',
      properties: {
        walletId: { type: 'string' },
        positionId: { type: 'string' },
        exitPrice: { type: 'string', description: 'Optional override; defaults to market price.' },
        idempotencyKey: { type: 'string' },
      },
      required: ['walletId', 'positionId'],
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
interface PlaceOrderArgs {
  walletId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
  quantity?: string;
  percent?: number;
  referencePrice?: number;
  price?: string;
  stopPrice?: string;
  marketType?: 'SPOT' | 'FUTURES';
  reduceOnly?: boolean;
  idempotencyKey?: string;
}
interface CancelOrderArgs {
  walletId: string;
  symbol: string;
  orderId: string;
  marketType?: 'SPOT' | 'FUTURES';
  idempotencyKey?: string;
}
interface ClosePositionArgs {
  walletId: string;
  positionId: string;
  exitPrice?: string;
  idempotencyKey?: string;
}

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
    case 'trading.place_order': {
      const a = (args ?? {}) as unknown as PlaceOrderArgs;
      await assertWriteAllowed(a.walletId, name);
      await assertPaperWallet(a.walletId, name);
      const { idempotencyKey, ...orderInput } = a;
      return audited(name, { walletId: a.walletId, inputJson: JSON.stringify(a), idempotencyKey: idempotencyKey ?? null }, () =>
        callProcedure('trading.createOrder', { marketType: 'FUTURES', ...orderInput }),
      );
    }
    case 'trading.cancel_order': {
      const a = (args ?? {}) as unknown as CancelOrderArgs;
      await assertWriteAllowed(a.walletId, name);
      await assertPaperWallet(a.walletId, name);
      const { idempotencyKey, ...cancelInput } = a;
      return audited(name, { walletId: a.walletId, inputJson: JSON.stringify(a), idempotencyKey: idempotencyKey ?? null }, () =>
        callProcedure('trading.cancelOrder', { marketType: 'FUTURES', ...cancelInput }),
      );
    }
    case 'trading.close_position': {
      const a = (args ?? {}) as unknown as ClosePositionArgs;
      await assertWriteAllowed(a.walletId, name);
      await assertPaperWallet(a.walletId, name);
      return audited(name, { walletId: a.walletId, inputJson: JSON.stringify(a), idempotencyKey: a.idempotencyKey ?? null }, () =>
        callProcedure('trading.closePosition', {
          id: a.positionId,
          ...(a.exitPrice ? { exitPrice: a.exitPrice } : {}),
        }),
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
