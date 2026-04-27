#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import * as a from './actions.js';
import { closeBrowser, getBaseUrl } from './browser.js';
import {
  MODALS,
  SETTINGS_TABS,
  SIDEBARS,
  STORES,
  TOOLBAR_ACTIONS,
  type ModalId,
  type SettingsTabId,
  type SidebarId,
  type StoreId,
  type Theme,
  type ToolbarAction,
} from './types.js';

const THEMES: Theme[] = ['light', 'dark'];

const tools: Tool[] = [
  {
    name: 'app.openSettings',
    description: 'Open the Settings dialog. Optionally targets a specific tab.',
    inputSchema: {
      type: 'object',
      properties: { tab: { type: 'string', enum: SETTINGS_TABS } },
    },
  },
  {
    name: 'app.closeSettings',
    description: 'Close the Settings dialog (delegates to closeAll).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'app.closeAll',
    description: 'Close every open modal/dialog/sidebar — useful before driving a new flow.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'app.openModal',
    description: 'Open one of the named modals (settings, orders, backtest, screener, analytics).',
    inputSchema: {
      type: 'object',
      properties: { modalId: { type: 'string', enum: MODALS } },
      required: ['modalId'],
    },
  },
  {
    name: 'app.navigateToSymbol',
    description: 'Navigate the chart to a specific symbol. Optionally specify market type.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        marketType: { type: 'string', enum: ['SPOT', 'FUTURES'] },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'app.setTimeframe',
    description: 'Change the chart timeframe (e.g. "1m", "5m", "1h", "1d").',
    inputSchema: {
      type: 'object',
      properties: { timeframe: { type: 'string' } },
      required: ['timeframe'],
    },
  },
  {
    name: 'app.setChartType',
    description: 'Change the chart type ("candle", "heikinAshi", "line", etc.).',
    inputSchema: {
      type: 'object',
      properties: { chartType: { type: 'string' } },
      required: ['chartType'],
    },
  },
  {
    name: 'app.setMarketType',
    description: 'Switch between SPOT and FUTURES market mode.',
    inputSchema: {
      type: 'object',
      properties: { marketType: { type: 'string', enum: ['SPOT', 'FUTURES'] } },
      required: ['marketType'],
    },
  },
  {
    name: 'app.applyTheme',
    description: 'Switch between light and dark color modes.',
    inputSchema: {
      type: 'object',
      properties: { theme: { type: 'string', enum: THEMES } },
      required: ['theme'],
    },
  },
  {
    name: 'app.toggleSidebar',
    description: 'Toggle a sidebar. Pass `open` to force a specific value.',
    inputSchema: {
      type: 'object',
      properties: {
        sidebarId: { type: 'string', enum: SIDEBARS },
        open: { type: 'boolean' },
      },
      required: ['sidebarId'],
    },
  },
  {
    name: 'app.toggleIndicator',
    description: 'Toggle visibility of a chart indicator instance by id.',
    inputSchema: {
      type: 'object',
      properties: { instanceId: { type: 'string' } },
      required: ['instanceId'],
    },
  },
  {
    name: 'app.dispatchToolbar',
    description: 'Trigger a toolbar action by id (allowlisted).',
    inputSchema: {
      type: 'object',
      properties: { action: { type: 'string', enum: [...TOOLBAR_ACTIONS] } },
      required: ['action'],
    },
  },
  {
    name: 'app.click',
    description: 'Escape hatch — Playwright click on a CSS selector.',
    inputSchema: {
      type: 'object',
      properties: { selector: { type: 'string' } },
      required: ['selector'],
    },
  },
  {
    name: 'app.fill',
    description: 'Escape hatch — Playwright fill on a CSS selector.',
    inputSchema: {
      type: 'object',
      properties: { selector: { type: 'string' }, value: { type: 'string' } },
      required: ['selector', 'value'],
    },
  },
  {
    name: 'app.waitFor',
    description: 'Wait until a selector or text appears in the page (default 10s).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        text: { type: 'string' },
        timeoutMs: { type: 'number', default: 10_000 },
      },
    },
  },
  {
    name: 'app.takeScreenshot',
    description: 'Take a screenshot of whatever is currently rendered.',
    inputSchema: {
      type: 'object',
      properties: { label: { type: 'string' } },
      required: ['label'],
    },
  },
  {
    name: 'app.inspectStore',
    description:
      'Read state from a renderer Zustand store (priceStore, uiStore, indicatorStore, ...). Read-only — strips non-serializable fields.',
    inputSchema: {
      type: 'object',
      properties: { storeId: { type: 'string', enum: STORES } },
      required: ['storeId'],
    },
  },
  {
    name: 'app.dispatchStore',
    description:
      'Dispatch an allowlisted action on a renderer Zustand store. Anything outside STORE_DISPATCH_ALLOWLIST is rejected.',
    inputSchema: {
      type: 'object',
      properties: {
        storeId: { type: 'string', enum: STORES },
        action: { type: 'string' },
        payload: {},
      },
      required: ['storeId', 'action'],
    },
  },
  {
    name: '__health',
    description: 'Verify the app server is alive and which dev URL it points at.',
    inputSchema: { type: 'object', properties: {} },
  },
];

interface ToolArgs {
  tab?: SettingsTabId;
  modalId?: ModalId;
  sidebarId?: SidebarId;
  storeId?: StoreId;
  theme?: Theme;
  symbol?: string;
  marketType?: 'SPOT' | 'FUTURES';
  timeframe?: string;
  chartType?: string;
  instanceId?: string;
  action?: ToolbarAction | string;
  payload?: unknown;
  selector?: string;
  value?: string;
  text?: string;
  timeoutMs?: number;
  open?: boolean;
  label?: string;
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

const handleTool = async (name: string, rawArgs: unknown) => {
  const args = (rawArgs ?? {}) as ToolArgs;
  switch (name) {
    case 'app.openSettings':
      return ok(await a.openSettings(args.tab));
    case 'app.closeSettings':
      return ok(await a.closeSettings());
    case 'app.closeAll':
      return ok(await a.closeAll());
    case 'app.openModal':
      return ok(await a.openModal(requireField(args, 'modalId')));
    case 'app.navigateToSymbol':
      return ok(await a.navigateToSymbol(requireField(args, 'symbol'), args.marketType));
    case 'app.setTimeframe':
      return ok(await a.setTimeframe(requireField(args, 'timeframe')));
    case 'app.setChartType':
      return ok(await a.setChartType(requireField(args, 'chartType')));
    case 'app.setMarketType':
      return ok(await a.setMarketType(requireField(args, 'marketType')));
    case 'app.applyTheme':
      return ok(await a.applyTheme(requireField(args, 'theme')));
    case 'app.toggleSidebar':
      return ok(await a.toggleSidebar(requireField(args, 'sidebarId'), args.open));
    case 'app.toggleIndicator':
      return ok(await a.toggleIndicator(requireField(args, 'instanceId')));
    case 'app.dispatchToolbar':
      return ok(await a.dispatchToolbar(requireField(args, 'action') as ToolbarAction));
    case 'app.click':
      return ok(await a.click(requireField(args, 'selector')));
    case 'app.fill':
      return ok(await a.fill(requireField(args, 'selector'), requireField(args, 'value')));
    case 'app.waitFor':
      return ok(await a.waitFor({ selector: args.selector, text: args.text, timeoutMs: args.timeoutMs }));
    case 'app.takeScreenshot':
      return ok(await a.takeScreenshot(requireField(args, 'label')));
    case 'app.inspectStore':
      return ok(await a.inspectStore(requireField(args, 'storeId')));
    case 'app.dispatchStore':
      return ok(
        await a.dispatchStore(
          requireField(args, 'storeId'),
          requireField(args, 'action') as string,
          args.payload,
        ),
      );
    case '__health':
      return ok({ ok: true, baseUrl: getBaseUrl(), tools: tools.length });
    default:
      return fail(`Unknown tool: ${name}`);
  }
};

const main = async () => {
  const server = new Server(
    { name: '@marketmind/mcp-app', version: '1.0.0' },
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

  const shutdown = async () => {
    await closeBrowser();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

main().catch((err) => {
  console.error('[mcp-app] fatal:', err);
  process.exit(1);
});
