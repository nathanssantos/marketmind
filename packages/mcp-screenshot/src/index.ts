#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { closeBrowser } from './browser.js';
import {
  captureFullPage,
  captureGallery,
  captureModal,
  captureSidebar,
  captureTab,
} from './capture.js';
import {
  MODALS,
  SETTINGS_TABS,
  SIDEBARS,
  type ModalId,
  type SettingsTabId,
  type SidebarId,
  type Theme,
} from './types.js';

const THEMES: Theme[] = ['light', 'dark'];

const tools: Tool[] = [
  {
    name: 'screenshot.tab',
    description:
      'Open the Settings modal on a specific tab and capture a screenshot. Use to verify a settings tab in light or dark mode.',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'string',
          enum: SETTINGS_TABS,
          description: 'Settings tab id to open before capture.',
        },
        theme: {
          type: 'string',
          enum: THEMES,
          default: 'dark',
          description: 'Color mode to apply before capture.',
        },
      },
      required: ['tabId'],
    },
  },
  {
    name: 'screenshot.modal',
    description:
      'Open one of the named modals (orders, backtest, screener, analytics, settings, etc.) and capture a screenshot.',
    inputSchema: {
      type: 'object',
      properties: {
        modalId: {
          type: 'string',
          enum: MODALS,
          description: 'Modal id to open before capture.',
        },
        theme: { type: 'string', enum: THEMES, default: 'dark' },
      },
      required: ['modalId'],
    },
  },
  {
    name: 'screenshot.sidebar',
    description:
      'Open one of the side panels (trading, autoTrading, market, orderFlow) and capture a screenshot. Sidebar is closed again afterwards.',
    inputSchema: {
      type: 'object',
      properties: {
        sidebarId: {
          type: 'string',
          enum: SIDEBARS,
          description: 'Sidebar id to toggle open before capture.',
        },
        theme: { type: 'string', enum: THEMES, default: 'dark' },
      },
      required: ['sidebarId'],
    },
  },
  {
    name: 'screenshot.fullPage',
    description:
      'Capture whatever is currently rendered in the dev app. Useful after a custom navigation/automation step.',
    inputSchema: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'Filename label for the capture (no extension).',
        },
        theme: { type: 'string', enum: THEMES, default: 'dark' },
      },
      required: ['label'],
    },
  },
  {
    name: 'screenshot.gallery',
    description:
      'Run a batch capture across the requested tabs/modals/sidebars × themes and emit an HTML gallery for side-by-side review.',
    inputSchema: {
      type: 'object',
      properties: {
        tabs: {
          oneOf: [
            { type: 'string', enum: ['all'] },
            { type: 'array', items: { type: 'string', enum: SETTINGS_TABS } },
          ],
          description: 'Settings tabs to include. Pass "all" or a list of tab ids.',
        },
        modals: {
          oneOf: [
            { type: 'string', enum: ['all'] },
            { type: 'array', items: { type: 'string', enum: MODALS } },
          ],
          description: 'Modals to include. Pass "all" or a list of modal ids.',
        },
        sidebars: {
          oneOf: [
            { type: 'string', enum: ['all'] },
            { type: 'array', items: { type: 'string', enum: SIDEBARS } },
          ],
          description: 'Sidebars to include. Pass "all" or a list of sidebar ids.',
        },
        themes: {
          type: 'array',
          items: { type: 'string', enum: THEMES },
          default: ['dark', 'light'],
        },
      },
    },
  },
  {
    name: '__health',
    description:
      'Verify the screenshot server can reach the dev app and its automation bridge is exposed.',
    inputSchema: { type: 'object', properties: {} },
  },
];

interface ToolArgs {
  tabId?: SettingsTabId;
  modalId?: ModalId;
  sidebarId?: SidebarId;
  theme?: Theme;
  label?: string;
  tabs?: 'all' | SettingsTabId[];
  modals?: 'all' | ModalId[];
  sidebars?: 'all' | SidebarId[];
  themes?: Theme[];
}

const ok = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

const fail = (message: string) => ({
  content: [{ type: 'text' as const, text: message }],
  isError: true,
});

const handleTool = async (name: string, rawArgs: unknown) => {
  const args = (rawArgs ?? {}) as ToolArgs;
  switch (name) {
    case 'screenshot.tab': {
      if (!args.tabId) return fail('tabId is required');
      const result = await captureTab(args.tabId, args.theme ?? 'dark');
      return ok(result);
    }
    case 'screenshot.modal': {
      if (!args.modalId) return fail('modalId is required');
      const result = await captureModal(args.modalId, args.theme ?? 'dark');
      return ok(result);
    }
    case 'screenshot.sidebar': {
      if (!args.sidebarId) return fail('sidebarId is required');
      const result = await captureSidebar(args.sidebarId, args.theme ?? 'dark');
      return ok(result);
    }
    case 'screenshot.fullPage': {
      if (!args.label) return fail('label is required');
      const result = await captureFullPage(args.label, args.theme ?? 'dark');
      return ok(result);
    }
    case 'screenshot.gallery': {
      const result = await captureGallery({
        tabs: args.tabs,
        modals: args.modals,
        sidebars: args.sidebars,
        themes: args.themes,
      });
      return ok({
        sessionDir: result.sessionDir,
        galleryHtmlPath: result.galleryHtmlPath,
        captureCount: result.captures.length,
      });
    }
    case '__health': {
      const baseUrl = process.env.MM_MCP_BASE_URL ?? 'http://localhost:5174';
      return ok({ ok: true, baseUrl, tools: tools.length });
    }
    default:
      return fail(`Unknown tool: ${name}`);
  }
};

const main = async () => {
  const server = new Server(
    {
      name: '@marketmind/mcp-screenshot',
      version: '1.0.0',
    },
    {
      capabilities: { tools: {} },
    },
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
  console.error('[mcp-screenshot] fatal:', err);
  process.exit(1);
});
