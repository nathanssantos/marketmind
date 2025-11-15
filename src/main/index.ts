import { app, BrowserWindow, ipcMain } from 'electron';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { storageService } from './services/StorageService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WINDOW_CONFIG = {
  WIDTH: 1280,
  HEIGHT: 800,
  MIN_WIDTH: 1024,
  MIN_HEIGHT: 768,
} as const;

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: WINDOW_CONFIG.WIDTH,
    height: WINDOW_CONFIG.HEIGHT,
    minWidth: WINDOW_CONFIG.MIN_WIDTH,
    minHeight: WINDOW_CONFIG.MIN_HEIGHT,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  const devServerUrl = process.env['VITE_DEV_SERVER_URL'];
  
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

const setupIpcHandlers = (): void => {
  ipcMain.handle('storage:isEncryptionAvailable', () => {
    return storageService.isEncryptionAvailable();
  });

  ipcMain.handle('storage:setApiKey', async (_event, provider: 'openai' | 'anthropic' | 'gemini' | 'newsapi' | 'cryptopanic', apiKey: string) => {
    try {
      storageService.setApiKey(provider, apiKey);
      return { success: true };
    } catch (error) {
      console.error(`Failed to set ${provider} API key:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  ipcMain.handle('storage:getApiKey', async (_event, provider: 'openai' | 'anthropic' | 'gemini' | 'newsapi' | 'cryptopanic') => {
    try {
      const apiKey = storageService.getApiKey(provider);
      return { success: true, apiKey };
    } catch (error) {
      console.error(`Failed to get ${provider} API key:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  ipcMain.handle('storage:deleteApiKey', async (_event, provider: 'openai' | 'anthropic' | 'gemini' | 'newsapi' | 'cryptopanic') => {
    try {
      storageService.deleteApiKey(provider);
      return { success: true };
    } catch (error) {
      console.error(`Failed to delete ${provider} API key:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  ipcMain.handle('storage:hasApiKey', async (_event, provider: 'openai' | 'anthropic' | 'gemini' | 'newsapi' | 'cryptopanic') => {
    return storageService.hasApiKey(provider);
  });

  ipcMain.handle('storage:getAllApiKeys', async () => {
    return storageService.getAllApiKeys();
  });

  ipcMain.handle('storage:clearAllApiKeys', async () => {
    try {
      storageService.clearAllApiKeys();
      return { success: true };
    } catch (error) {
      console.error('Failed to clear API keys:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });
  
  ipcMain.handle('storage:getNewsSettings', async () => {
    return storageService.getNewsSettings();
  });

  ipcMain.handle('storage:setNewsSettings', async (_event, settings: { enabled: boolean; refreshInterval: number; maxArticles: number }) => {
    try {
      storageService.setNewsSettings(settings);
      return { success: true };
    } catch (error) {
      console.error('Failed to set news settings:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });
};

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
