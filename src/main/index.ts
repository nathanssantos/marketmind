import type { BrowserWindow as BrowserWindowType } from 'electron';
import * as electron from 'electron';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { storageService } from './services/StorageService';
import { UpdateManager } from './services/UpdateManager';
import { windowStateManager } from './services/WindowStateManager';

const { app, BrowserWindow, ipcMain } = electron;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WINDOW_CONFIG = {
  WIDTH: 1280,
  HEIGHT: 800,
  MIN_WIDTH: 1024,
  MIN_HEIGHT: 768,
} as const;

let mainWindow: BrowserWindowType | null = null;
let updateManager: UpdateManager | null = null;

const createWindow = (): void => {
  console.log('Creating main window...');
  
  const windowState = windowStateManager.getState();
  
  const windowOptions: electron.BrowserWindowConstructorOptions = {
    width: windowState.width,
    height: windowState.height,
    minWidth: WINDOW_CONFIG.MIN_WIDTH,
    minHeight: WINDOW_CONFIG.MIN_HEIGHT,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  };

  if (windowState.x !== undefined) windowOptions.x = windowState.x;
  if (windowState.y !== undefined) windowOptions.y = windowState.y;
  
  mainWindow = new BrowserWindow(windowOptions);
  console.log('BrowserWindow created');

  windowStateManager.manage(mainWindow);

  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow?.show();
  });

  const devServerUrl = process.env['VITE_DEV_SERVER_URL'];
  console.log('Dev server URL:', devServerUrl);
  
  if (devServerUrl) {
    console.log('Loading dev server URL...');
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

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

const createSuccessResponse = (data?: unknown) => ({ 
  success: true, 
  ...(data !== undefined && { data }) 
});

const createErrorResponse = (error: unknown, defaultData?: unknown) => ({
  success: false,
  error: error instanceof Error ? error.message : 'Unknown error',
  ...(defaultData !== undefined && { data: defaultData }),
});

const handleStorageOperation = async <T>(
  operation: () => T,
  errorMessage: string,
  options: { returnData?: boolean; defaultData?: unknown } = {}
): Promise<{ success: boolean; data?: T; error?: string }> => {
  try {
    const result = operation();
    return options.returnData ? createSuccessResponse(result) : createSuccessResponse();
  } catch (error) {
    console.error(errorMessage, error);
    return createErrorResponse(error, options.defaultData) as { success: boolean; data?: T; error?: string };
  }
};

const setupIpcHandlers = (): void => {
  ipcMain.handle('storage:isEncryptionAvailable', () => storageService.isEncryptionAvailable());

  ipcMain.handle('storage:setApiKey', async (_event, provider: 'openai' | 'anthropic' | 'gemini' | 'newsapi' | 'cryptopanic', apiKey: string) =>
    handleStorageOperation(
      () => storageService.setApiKey(provider, apiKey),
      `Failed to set ${provider} API key:`
    )
  );

  ipcMain.handle('storage:getApiKey', async (_event, provider: 'openai' | 'anthropic' | 'gemini' | 'newsapi' | 'cryptopanic') =>
    handleStorageOperation(
      () => ({ apiKey: storageService.getApiKey(provider) }),
      `Failed to get ${provider} API key:`,
      { returnData: false }
    ).then(result => result.success ? { success: true, apiKey: (result.data as { apiKey: string | null }).apiKey } : result)
  );

  ipcMain.handle('storage:deleteApiKey', async (_event, provider: 'openai' | 'anthropic' | 'gemini' | 'newsapi' | 'cryptopanic') =>
    handleStorageOperation(
      () => storageService.deleteApiKey(provider),
      `Failed to delete ${provider} API key:`
    )
  );

  ipcMain.handle('storage:hasApiKey', async (_event, provider: 'openai' | 'anthropic' | 'gemini' | 'newsapi' | 'cryptopanic') =>
    storageService.hasApiKey(provider)
  );

  ipcMain.handle('storage:getAllApiKeys', async () => storageService.getAllApiKeys());

  ipcMain.handle('storage:clearAllApiKeys', async () =>
    handleStorageOperation(
      () => storageService.clearAllApiKeys(),
      'Failed to clear API keys:'
    )
  );
  
  ipcMain.handle('storage:getNewsSettings', async () => storageService.getNewsSettings());

  ipcMain.handle('storage:setNewsSettings', async (_event, settings: { enabled: boolean; refreshInterval: number; maxArticles: number }) =>
    handleStorageOperation(
      () => storageService.setNewsSettings(settings),
      'Failed to set news settings:'
    )
  );

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

  ipcMain.handle('storage:getAIData', async () =>
    handleStorageOperation(
      () => storageService.getAIData(),
      'Failed to get AI data:',
      { returnData: true, defaultData: null }
    )
  );

  ipcMain.handle('storage:setAIData', async (_event, data) =>
    handleStorageOperation(
      () => storageService.setAIData(data),
      'Failed to set AI data:'
    )
  );

  ipcMain.handle('storage:clearAIData', async () =>
    handleStorageOperation(
      () => storageService.clearAIData(),
      'Failed to clear AI data:'
    )
  );

  ipcMain.handle('storage:getAIStudies', async () =>
    handleStorageOperation(
      () => storageService.getAIStudies(),
      'Failed to get AI studies:',
      { returnData: true, defaultData: {} }
    )
  );

  ipcMain.handle('storage:setAIStudies', async (_event, studies) =>
    handleStorageOperation(
      () => storageService.setAIStudies(studies),
      'Failed to set AI studies:'
    )
  );

  ipcMain.handle('storage:getAIStudiesForSymbol', async (_event, symbol) =>
    handleStorageOperation(
      () => storageService.getAIStudiesForSymbol(symbol),
      'Failed to get AI studies for symbol:',
      { returnData: true, defaultData: null }
    )
  );

  ipcMain.handle('storage:setAIStudiesForSymbol', async (_event, symbol, data) =>
    handleStorageOperation(
      () => storageService.setAIStudiesForSymbol(symbol, data),
      'Failed to set AI studies for symbol:'
    )
  );

  ipcMain.handle('storage:deleteAIStudiesForSymbol', async (_event, symbol) =>
    handleStorageOperation(
      () => storageService.deleteAIStudiesForSymbol(symbol),
      'Failed to delete AI studies for symbol:'
    )
  );

  ipcMain.handle('storage:clearAIStudies', async () =>
    handleStorageOperation(
      () => storageService.clearAIStudies(),
      'Failed to clear AI studies:'
    )
  );
};

app.whenReady().then(() => {
  console.log('App ready, setting up IPC handlers...');
  setupIpcHandlers();
  console.log('IPC handlers set up, creating window...');
  createWindow();
  console.log('Window created');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((error) => {
  console.error('Error during app initialization:', error);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
