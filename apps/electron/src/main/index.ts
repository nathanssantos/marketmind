import type { BrowserWindow as BrowserWindowType } from 'electron';
import * as electron from 'electron';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  setupHttpHandlers,
  setupNotificationHandlers,
  setupUpdateIpcHandlers,
  setupWindowHandlers,
} from './ipcHandlers';
import { UpdateManager } from './services/UpdateManager';
import { windowStateManager } from './services/WindowStateManager';

const { app, BrowserWindow, crashReporter, powerSaveBlocker } = electron;

let powerSaveBlockerId: number | null = null;

app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization');
app.commandLine.appendSwitch('disable-gpu-driver-bug-workarounds');
app.commandLine.appendSwitch('force-gpu-mem-available-mb', '1024');
app.commandLine.appendSwitch('gpu-rasterization-msaa-sample-count', '0');

crashReporter.start({
  productName: 'MarketMind',
  submitURL: '',
  uploadToServer: false,
  ignoreSystemCrashHandler: false,
});

const DEBUG_STARTUP = process.env['DEBUG_STARTUP'] === 'true';

const debugLog = (...args: unknown[]): void => {
  if (DEBUG_STARTUP) console.log(...args);
};

const MEMORY_MONITOR = {
  BYTES_PER_KB: 1024,
  HIGH_MEMORY_THRESHOLD_MB: 500,
  CHECK_INTERVAL_MS: 60_000,
  DECIMAL_PLACES: 2,
} as const;

let memoryMonitorInterval: ReturnType<typeof setInterval> | null = null;

const bytesToMB = (bytes: number): string =>
  (bytes / MEMORY_MONITOR.BYTES_PER_KB / MEMORY_MONITOR.BYTES_PER_KB).toFixed(MEMORY_MONITOR.DECIMAL_PLACES);

const startMemoryMonitor = (): void => {
  if (memoryMonitorInterval) return;

  memoryMonitorInterval = setInterval(() => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = bytesToMB(memUsage.heapUsed);
    const heapTotalMB = bytesToMB(memUsage.heapTotal);
    const rssMB = bytesToMB(memUsage.rss);
    const highThresholdBytes = MEMORY_MONITOR.HIGH_MEMORY_THRESHOLD_MB * MEMORY_MONITOR.BYTES_PER_KB * MEMORY_MONITOR.BYTES_PER_KB;

    if (memUsage.heapUsed > highThresholdBytes) {
      console.warn(`[Main] High memory usage detected: Heap ${heapUsedMB}MB / ${heapTotalMB}MB, RSS ${rssMB}MB`);
    }
  }, MEMORY_MONITOR.CHECK_INTERVAL_MS);
};

const stopMemoryMonitor = (): void => {
  if (memoryMonitorInterval) {
    clearInterval(memoryMonitorInterval);
    memoryMonitorInterval = null;
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getIconPath = (): string => {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'icon.png');
  }
  return join(__dirname, '../../build/icon.png');
};

const WINDOW_CONFIG = {
  WIDTH: 1280,
  HEIGHT: 800,
  MIN_WIDTH: 320,
  MIN_HEIGHT: 600,
} as const;

let mainWindow: BrowserWindowType | null = null;
let updateManager: UpdateManager | null = null;
const chartWindows: Map<number, BrowserWindowType> = new Map();
let chartWindowCounter = 0;

const createChartWindow = (symbol?: string, timeframe?: string): number => {
  debugLog('Creating chart window for symbol:', symbol || 'default', 'timeframe:', timeframe || 'default');

  const windowId = ++chartWindowCounter;
  const windowOptions: electron.BrowserWindowConstructorOptions = {
    width: 1000,
    height: 700,
    minWidth: 320,
    minHeight: 400,
    show: false,
    title: `MarketMind - ${symbol || 'Chart'}`,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: true,
      enableWebSQL: false,
      webgl: true,
      spellcheck: false,
      autoplayPolicy: 'user-gesture-required',
      sandbox: true,
      v8CacheOptions: 'code',
    },
  };

  const chartWindow = new BrowserWindow(windowOptions);
  chartWindows.set(windowId, chartWindow);

  const devServerUrl = process.env['VITE_DEV_SERVER_URL'];
  if (!devServerUrl) {
    chartWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self';",
            "script-src 'self';",
            "style-src 'self' 'unsafe-inline';",
            "img-src 'self' data: https:;",
            "font-src 'self' data:;",
            "connect-src 'self' http://localhost:* ws://localhost:* wss://*.binance.com https://*.binance.com;",
          ].join(' '),
        },
      });
    });
  }

  chartWindow.once('ready-to-show', () => {
    debugLog('Chart window ready to show');
    chartWindow?.show();
  });

  const urlPath = symbol && timeframe
    ? `#/chart/${encodeURIComponent(symbol)}/${encodeURIComponent(timeframe)}`
    : symbol
      ? `#/chart/${encodeURIComponent(symbol)}`
      : '#/chart';

  if (devServerUrl) {
    void chartWindow.loadURL(`${devServerUrl}${urlPath}`);
  } else {
    void chartWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: symbol && timeframe
        ? `/chart/${encodeURIComponent(symbol)}/${encodeURIComponent(timeframe)}`
        : symbol
          ? `/chart/${encodeURIComponent(symbol)}`
          : '/chart'
    });
  }

  chartWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12' || (input.key === 'I' && (input.meta || input.control) && input.shift)) {
      chartWindow?.webContents.toggleDevTools();
    }
  });

  chartWindow.on('closed', () => {
    chartWindows.delete(windowId);
    debugLog(`Chart window ${windowId} closed`);
  });

  return windowId;
};

const createWindow = (): void => {
  debugLog('Creating main window...');

  const windowState = windowStateManager.getState();

  const windowOptions: electron.BrowserWindowConstructorOptions = {
    width: windowState.width,
    height: windowState.height,
    minWidth: WINDOW_CONFIG.MIN_WIDTH,
    minHeight: WINDOW_CONFIG.MIN_HEIGHT,
    show: false,
    icon: getIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: true,
      enableWebSQL: false,
      webgl: true,
      spellcheck: false,
      autoplayPolicy: 'user-gesture-required',
      sandbox: true,
      v8CacheOptions: 'code',
    },
  };

  if (windowState.x !== undefined) windowOptions.x = windowState.x;
  if (windowState.y !== undefined) windowOptions.y = windowState.y;

  mainWindow = new BrowserWindow(windowOptions);
  debugLog('BrowserWindow created');

  const devServerUrl = process.env['VITE_DEV_SERVER_URL'];
  if (!devServerUrl) {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self';",
            "script-src 'self';",
            "style-src 'self' 'unsafe-inline';",
            "img-src 'self' data: https:;",
            "font-src 'self' data:;",
            "connect-src 'self' http://localhost:* ws://localhost:* wss://*.binance.com https://*.binance.com;",
          ].join(' '),
        },
      });
    });
  }

  windowStateManager.manage(mainWindow);

  mainWindow.once('ready-to-show', () => {
    debugLog('Window ready to show');
    mainWindow?.show();
  });

  debugLog('Dev server URL:', devServerUrl);

  if (devServerUrl) {
    debugLog('Loading dev server URL...');
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12' || (input.key === 'I' && (input.meta || input.control) && input.shift)) {
      mainWindow?.webContents.toggleDevTools();
    }
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    const crashInfo = {
      reason: details.reason,
      exitCode: details.exitCode,
      timestamp: new Date().toISOString(),
      platform: process.platform,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      v8Version: process.versions.v8,
      crashDumpsDir: app.getPath('crashDumps'),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    };

    console.error('[Main] ═══════════════════════════════════════════════════════════');
    console.error('[Main] RENDERER PROCESS CRASH DETECTED');
    console.error('[Main] ═══════════════════════════════════════════════════════════');
    console.error('[Main] Reason:', details.reason);
    console.error('[Main] Exit Code:', details.exitCode);
    console.error('[Main] Timestamp:', crashInfo.timestamp);
    console.error('[Main] Platform:', crashInfo.platform);
    console.error('[Main] Electron:', crashInfo.electronVersion);
    console.error('[Main] Chrome:', crashInfo.chromeVersion);
    console.error('[Main] Node:', crashInfo.nodeVersion);
    console.error('[Main] V8:', crashInfo.v8Version);
    console.error('[Main] Crash Dumps Dir:', crashInfo.crashDumpsDir);
    console.error('[Main] Memory Usage:', JSON.stringify(crashInfo.memoryUsage, null, 2));
    console.error('[Main] Process Uptime:', crashInfo.uptime.toFixed(2), 'seconds');
    console.error('[Main] ═══════════════════════════════════════════════════════════');

    if (details.exitCode === 5) {
      console.error('[Main] Exit code 5 typically indicates:');
      console.error('[Main]   - SIGTRAP on macOS (debugger/GPU issues)');
      console.error('[Main]   - Access violation or GPU driver crash');
      console.error('[Main]   - WebGL context lost or corrupted');
      console.error('[Main] Check crash dumps at:', crashInfo.crashDumpsDir);
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      if (details.reason === 'crashed' || details.reason === 'oom' || details.reason === 'killed') {
        console.log('[Main] Attempting to reload window after crash...');
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.reload();
          }
        }, 1000);
      }
    }
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('[Main] Renderer process became unresponsive');
  });

  mainWindow.webContents.on('responsive', () => {
    console.log('[Main] Renderer process is responsive again');
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      const levelName = ['verbose', 'info', 'warning', 'error'][level] || 'unknown';
      console.log(`[Renderer ${levelName}] ${message} (${sourceId}:${line})`);
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Main] Page failed to load:', { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[Main] Preload script error:', { preloadPath, error });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    updateManager?.stopAutoCheckInterval();
    updateManager = null;
  });

  debugLog('Initializing UpdateManager...');
  try {
    updateManager = new UpdateManager(mainWindow);
    debugLog('UpdateManager initialized successfully');
    debugLog('Setting up update IPC handlers...');
    setupUpdateIpcHandlers(() => updateManager);
    debugLog('Update setup complete');
  } catch (error) {
    console.error('Error initializing UpdateManager:', error);
  }
};

const logGpuInfo = (): void => {
  if (!DEBUG_STARTUP) return;
  const gpuInfo = app.getGPUFeatureStatus();
  console.log('[Main] ═══════════════════════════════════════════════════════════');
  console.log('[Main] GPU FEATURE STATUS');
  console.log('[Main] ═══════════════════════════════════════════════════════════');
  Object.entries(gpuInfo).forEach(([feature, status]) => {
    console.log(`[Main] ${feature}: ${status}`);
  });
  console.log('[Main] ═══════════════════════════════════════════════════════════');
};

const startPowerSaveBlocker = (): void => {
  if (powerSaveBlockerId !== null) return;
  powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  debugLog('[Main] PowerSaveBlocker started with id:', powerSaveBlockerId);
};

const stopPowerSaveBlocker = (): void => {
  if (powerSaveBlockerId === null) return;
  powerSaveBlocker.stop(powerSaveBlockerId);
  debugLog('[Main] PowerSaveBlocker stopped');
  powerSaveBlockerId = null;
};

const initializeApp = async (): Promise<void> => {
  try {
    await app.whenReady();
    debugLog('App ready, setting up IPC handlers...');
    logGpuInfo();
    startMemoryMonitor();
    startPowerSaveBlocker();
    setupHttpHandlers();
    setupWindowHandlers(createChartWindow, () => Array.from(chartWindows.keys()));
    setupNotificationHandlers();
    debugLog('IPC handlers set up, creating window...');
    createWindow();
    debugLog('Window created');

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Error during app initialization:', error);
  }
};

void initializeApp();

app.on('child-process-gone', (_event, details) => {
  console.error('[Main] ═══════════════════════════════════════════════════════════');
  console.error('[Main] CHILD PROCESS GONE');
  console.error('[Main] ═══════════════════════════════════════════════════════════');
  console.error('[Main] Type:', details.type);
  console.error('[Main] Reason:', details.reason);
  console.error('[Main] Exit Code:', details.exitCode);
  if (details.serviceName) console.error('[Main] Service Name:', details.serviceName);
  if (details.name) console.error('[Main] Name:', details.name);
  console.error('[Main] ═══════════════════════════════════════════════════════════');
});

app.on('gpu-info-update', () => {
  debugLog('[Main] GPU info updated');
  logGpuInfo();
});

process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception in main process:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] Unhandled rejection at:', promise, 'reason:', reason);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopMemoryMonitor();
    app.quit();
  }
});

app.on('before-quit', () => {
  stopMemoryMonitor();
  stopPowerSaveBlocker();
});
