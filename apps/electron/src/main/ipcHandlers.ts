import * as electron from 'electron';
import type { UpdateManager } from './services/UpdateManager';

const { ipcMain, net, Notification } = electron;

const DEBUG_STARTUP = process.env['DEBUG_STARTUP'] === 'true';

const debugLog = (...args: unknown[]): void => {
  if (DEBUG_STARTUP) console.log(...args);
};

export const setupUpdateIpcHandlers = (getUpdateManager: () => UpdateManager | null): void => {
  ipcMain.handle('update:check', async () => {
    try {
      const updateManager = getUpdateManager();
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
      const updateManager = getUpdateManager();
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
      const updateManager = getUpdateManager();
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
    const updateManager = getUpdateManager();
    if (!updateManager) {
      throw new Error('UpdateManager not initialized');
    }
    return updateManager.getUpdateInfo();
  });

  ipcMain.handle('update:startAutoCheck', async (_event, intervalHours: number) => {
    try {
      const updateManager = getUpdateManager();
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
      const updateManager = getUpdateManager();
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

export const setupHttpHandlers = (): void => {
  ipcMain.handle('http:fetch', async (_event, url, options = {}) => {
    try {
      debugLog('[Main] HTTP fetch request:', url);
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
          debugLog('[Main] Response status:', response.statusCode, response.statusMessage);

          response.on('data', (chunk) => {
            responseData += chunk.toString();
          });

          response.on('end', () => {
            try {
              debugLog('[Main] Raw response data (first 500 chars):', responseData.substring(0, 500));
              const data = JSON.parse(responseData);
              debugLog('[Main] Response data parsed successfully');

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

export const setupWindowHandlers = (
  createChartWindow: (symbol?: string, timeframe?: string) => number,
  getChartWindowIds: () => number[]
): void => {
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
    return getChartWindowIds();
  });
};

export const setupNotificationHandlers = (): void => {
  ipcMain.handle('notification:show', async (_event, options: { title: string; body: string; silent?: boolean; urgency?: 'normal' | 'critical' | 'low' }) => {
    debugLog('[Notification] show called with:', options);
    try {
      const supported = Notification.isSupported();
      debugLog('[Notification] isSupported:', supported);
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
        debugLog('[Notification] Notification shown successfully');
      });

      notification.on('click', () => {
        debugLog('[Notification] Notification clicked');
      });

      notification.on('close', () => {
        debugLog('[Notification] Notification closed');
      });

      notification.show();
      debugLog('[Notification] notification.show() called');

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
    debugLog('[Notification] isSupported check:', supported);
    return supported;
  });
};
