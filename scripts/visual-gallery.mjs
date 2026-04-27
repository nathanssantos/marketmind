#!/usr/bin/env node
/**
 * Drive the mcp-screenshot capture pipeline directly (no MCP transport).
 * Used for quick visual review iterations during Phase 6.x.
 *
 * Env vars honored:
 *   MM_MCP_BASE_URL   — dev server URL (default http://localhost:5174)
 *   MM_MCP_SCALE      — deviceScaleFactor (default 1; bump to 2 for retina)
 *   MM_MCP_FIXTURES   — set to "false" to skip the tRPC mock fixtures
 */
import { captureGallery } from '../packages/mcp-screenshot/dist/capture.js';
import { closeBrowser } from '../packages/mcp-screenshot/dist/browser.js';

const result = await captureGallery({
  tabs: 'all',
  modals: 'all',
  sidebars: 'all',
  themes: ['dark', 'light'],
});

console.log(`captures: ${result.captures.length}`);
console.log(`gallery:  ${result.galleryHtmlPath}`);
console.log(`session:  ${result.sessionDir}`);

await closeBrowser();
