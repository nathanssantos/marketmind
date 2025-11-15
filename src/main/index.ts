import { app, BrowserWindow, ipcMain } from 'electron';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { storageService } from './services/StorageService';
import { MigrationService } from './services/MigrationService';

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

  ipcMain.handle('storage:setApiKey', async (_event, apiKey: string) => {
    try {
      storageService.setApiKey(apiKey);
      return { success: true };
    } catch (error) {
      console.error('Failed to set API key:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  ipcMain.handle('storage:getApiKey', async () => {
    try {
      const apiKey = storageService.getApiKey();
      return { success: true, apiKey };
    } catch (error) {
      console.error('Failed to get API key:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  ipcMain.handle('storage:deleteApiKey', async () => {
    try {
      storageService.deleteApiKey();
      return { success: true };
    } catch (error) {
      console.error('Failed to delete API key:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  ipcMain.handle('storage:hasApiKey', async () => {
    return storageService.hasApiKey();
  });
};

app.whenReady().then(async () => {
  try {
    await MigrationService.runMigrations();
  } catch (error) {
    console.error('Migration failed:', error);
  }

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
