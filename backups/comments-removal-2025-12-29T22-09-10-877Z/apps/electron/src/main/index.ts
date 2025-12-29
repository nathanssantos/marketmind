import type { BrowserWindow as BrowserWindowType } from 'electron';
import * as electron from 'electron';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { storageService } from './services/StorageService';
import { UpdateManager } from './services/UpdateManager';
import { windowStateManager } from './services/WindowStateManager';

const { app, BrowserWindow, ipcMain, net, Notification } = electron;

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
  console.log('Creating chart window for symbol:', symbol || 'default', 'timeframe:', timeframe || 'default');
  
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
    console.log('Chart window ready to show');
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
    console.log(`Chart window ${windowId} closed`);
  });

  return windowId;
};

const createWindow = (): void => {
  console.log('Creating main window...');
  
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
  console.log('BrowserWindow created');

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
    console.log('Window ready to show');
    mainWindow?.show();
  });

  console.log('Dev server URL:', devServerUrl);
  
  if (devServerUrl) {
    console.log('Loading dev server URL...');
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
    console.error('[Main] Renderer process gone:', details.reason, details.exitCode);
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

  mainWindow.on('closed', () => {
    mainWindow = null;
    updateManager?.stopAutoCheckInterval();
    updateManager = null;
  });
  
  console.log('Initializing UpdateManager...');
  try {
    updateManager = new UpdateManager(mainWindow);
    console.log('UpdateManager initialized successfully');
    console.log('Setting up update IPC handlers...');
    setupUpdateIpcHandlers();
    console.log('Update setup complete');
  } catch (error) {
    console.error('Error initializing UpdateManager:', error);
  }
};

const setupUpdateIpcHandlers = (): void => {
  ipcMain.handle('update:check', async () => {
    try {
      if (!updateManager) {
        throw new Error('UpdateManager not initialized');
      }
      await updateManager.checkForUpdates();
      return { success: true };
    } catch (error) {
      console.error('Failed to check for updates:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('update:download', async () => {
    try {
      if (!updateManager) {
        throw new Error('UpdateManager not initialized');
      }
      await updateManager.downloadUpdate();
      return { success: true };
    } catch (error) {
      console.error('Failed to download update:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('update:install', () => {
    try {
      if (!updateManager) {
        throw new Error('UpdateManager not initialized');
      }
      updateManager.quitAndInstall();
      return { success: true };
    } catch (error) {
      console.error('Failed to install update:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('update:getInfo', () => {
    if (!updateManager) {
      throw new Error('UpdateManager not initialized');
    }
    return updateManager.getUpdateInfo();
  });

  ipcMain.handle('update:startAutoCheck', async (_event, intervalHours: number) => {
    try {
      if (!updateManager) {
        throw new Error('UpdateManager not initialized');
      }
      updateManager.startAutoCheckInterval(intervalHours);
      return { success: true };
    } catch (error) {
      console.error('Failed to start auto check:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('update:stopAutoCheck', () => {
    try {
      if (!updateManager) {
        throw new Error('UpdateManager not initialized');
      }
      updateManager.stopAutoCheckInterval();
      return { success: true };
    } catch (error) {
      console.error('Failed to stop auto check:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
};

const createSuccessResponse = <T = undefined>(data?: T): { success: boolean; data?: T; error?: string } => ({ 
  success: true, 
  ...(data !== undefined && { data }) 
});

const createErrorResponse = <T = undefined>(error: unknown, defaultData?: T): { success: boolean; data?: T; error?: string } => ({
  success: false,
  error: error instanceof Error ? error.message : 'Unknown error',
  ...(defaultData !== undefined && { data: defaultData }),
});

const handleStorageOperation = async <T>(
  operation: () => T,
  errorMessage: string,
  options: { returnData?: boolean; defaultData?: unknown } = {}
): Promise<{ success: boolean; data?: T | undefined; error?: string }> => {
  try {
    const result = operation();
    return options.returnData ? createSuccessResponse<T>(result) : createSuccessResponse<T | undefined>(undefined);
  } catch (error) {
    console.error(errorMessage, error);
    return createErrorResponse<T | undefined>(error, options.defaultData as T | undefined);
  }
};

const setupIpcHandlers = (): void => {
  ipcMain.handle('storage:isEncryptionAvailable', () => storageService.isEncryptionAvailable());

  ipcMain.handle('storage:getTradingData', async () =>
    handleStorageOperation(
      () => storageService.getTradingData(),
      'Failed to get trading data:',
      { returnData: true, defaultData: null }
    )
  );

  ipcMain.handle('storage:setTradingData', async (_event, data) =>
    handleStorageOperation(
      () => storageService.setTradingData(data),
      'Failed to set trading data:'
    )
  );

  ipcMain.handle('storage:clearTradingData', async () =>
    handleStorageOperation(
      () => storageService.clearTradingData(),
      'Failed to clear trading data:'
    )
  );

  ipcMain.handle('http:fetch', async (_event, url, options = {}) => {
    try {
      console.log('[Main] HTTP fetch request:', url);
      const { method = 'GET', headers = {}, body } = options;

      const defaultHeaders = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        ...headers,
      };

      return new Promise((resolve) => {
        const request = net.request({
          method,
          url,
        });

        Object.entries(defaultHeaders).forEach(([key, value]) => {
          request.setHeader(key, value as string);
        });

        if (body) {
          const bodyData = typeof body === 'string' ? body : JSON.stringify(body);
          request.write(bodyData);
        }

        let responseData = '';

        request.on('response', (response) => {
          console.log('[Main] Response status:', response.statusCode, response.statusMessage);

          response.on('data', (chunk) => {
            responseData += chunk.toString();
          });

          response.on('end', () => {
            try {
              console.log('[Main] Raw response data (first 500 chars):', responseData.substring(0, 500));
              const data = JSON.parse(responseData);
              console.log('[Main] Response data parsed successfully');
              
              resolve({
                success: response.statusCode >= 200 && response.statusCode < 300,
                status: response.statusCode,
                statusText: response.statusMessage || '',
                data,
                headers: response.headers,
              });
            } catch (error) {
              console.error('[Main] Failed to parse response. Raw data:', responseData);
              console.error('[Main] Parse error:', error);
              resolve({
                success: false,
                status: response.statusCode,
                statusText: 'Failed to parse response',
                error: error instanceof Error ? error.message : 'Unknown error',
                rawData: responseData,
              });
            }
          });
        });

        request.on('error', (error) => {
          console.error('[Main] HTTP fetch error:', error);
          resolve({
            success: false,
            status: 0,
            statusText: 'Network Error',
            error: error.message,
          });
        });

        request.end();
      });
    } catch (error) {
      console.error('[Main] HTTP fetch setup error:', error);
      return {
        success: false,
        status: 0,
        statusText: 'Network Error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
};

const setupWindowHandlers = (): void => {
  ipcMain.handle('window:openChart', async (_event, symbol?: string, timeframe?: string) => {
    try {
      const windowId = createChartWindow(symbol, timeframe);
      return { success: true, windowId };
    } catch (error) {
      console.error('Failed to open chart window:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('window:getChartWindows', async () => {
    return Array.from(chartWindows.keys());
  });
};

const setupNotificationHandlers = (): void => {
  ipcMain.handle('notification:show', async (_event, options: { title: string; body: string; silent?: boolean; urgency?: 'normal' | 'critical' | 'low' }) => {
    console.log('[Notification] show called with:', options);
    try {
      const supported = Notification.isSupported();
      console.log('[Notification] isSupported:', supported);
      if (!supported) {
        return {
          success: false,
          error: 'Notifications are not supported on this system'
        };
      }

      const notification = new Notification({
        title: options.title,
        body: options.body,
        silent: options.silent ?? false,
        urgency: options.urgency ?? 'normal',
      });

      notification.on('show', () => {
        console.log('[Notification] Notification shown successfully');
      });

      notification.on('click', () => {
        console.log('[Notification] Notification clicked');
      });

      notification.on('close', () => {
        console.log('[Notification] Notification closed');
      });

      notification.show();
      console.log('[Notification] notification.show() called');

      return { success: true };
    } catch (error) {
      console.error('[Notification] Failed to show notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('notification:isSupported', async () => {
    const supported = Notification.isSupported();
    console.log('[Notification] isSupported check:', supported);
    return supported;
  });
};

const initializeApp = async (): Promise<void> => {
  try {
    await app.whenReady();
    console.log('App ready, setting up IPC handlers...');
    setupIpcHandlers();
    setupWindowHandlers();
    setupNotificationHandlers();
    console.log('IPC handlers set up, creating window...');
    createWindow();
    console.log('Window created');

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
