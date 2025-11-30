import type { BrowserWindow as BrowserWindowType } from 'electron';
import * as electron from 'electron';
import log from 'electron-log';
import type { UpdateInfo } from 'electron-updater';
import * as electronUpdater from 'electron-updater';
import type { Timeout } from 'node:timers';

const { app } = electron;
const { autoUpdater } = electronUpdater;

export class UpdateManager {
  private window: BrowserWindowType;
  private updateCheckInterval: Timeout | null = null;
  private isDevelopment: boolean;

  constructor(window: BrowserWindowType) {
    this.window = window;
    this.isDevelopment = process.env['NODE_ENV'] === 'development';
    
    if (!this.isDevelopment) {
      this.setupAutoUpdater();
      this.setupEventHandlers();
    } else {
      log.info('UpdateManager: Running in development mode, auto-updater disabled');
    }
  }

  private setupAutoUpdater(): void {
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    
    if (process.env['NODE_ENV'] === 'development') {
      autoUpdater.forceDevUpdateConfig = true;
    }
  }

  private setupEventHandlers(): void {
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for updates...');
      this.window.webContents.send('update:checking');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      log.info('Update available:', info.version);
      this.window.webContents.send('update:available', {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate,
      });
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      log.info('Update not available. Current version is latest:', info.version);
      this.window.webContents.send('update:not-available', {
        version: info.version,
      });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
      log.info(logMessage);
      
      this.window.webContents.send('update:download-progress', {
        percent: Math.round(progressObj.percent),
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond,
      });
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      log.info('Update downloaded:', info.version);
      this.window.webContents.send('update:downloaded', {
        version: info.version,
        releaseNotes: info.releaseNotes,
      });
    });

    autoUpdater.on('error', (error) => {
      log.error('Update error:', error);
      this.window.webContents.send('update:error', {
        message: error.message,
        stack: error.stack,
      });
    });
  }

  async checkForUpdates(): Promise<void> {
    if (this.isDevelopment) {
      log.info('UpdateManager: Skipping update check in development mode');
      return;
    }

    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      log.error('Error checking for updates:', error);
      throw error;
    }
  }

  async downloadUpdate(): Promise<void> {
    if (this.isDevelopment) {
      log.info('UpdateManager: Skipping download in development mode');
      return;
    }

    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      log.error('Error downloading update:', error);
      throw error;
    }
  }

  quitAndInstall(): void {
    if (this.isDevelopment) {
      log.info('UpdateManager: Skipping install in development mode');
      return;
    }

    try {
      autoUpdater.quitAndInstall(false, true);
    } catch (error) {
      log.error('Error installing update:', error);
      throw error;
    }
  }

  startAutoCheckInterval(intervalHours: number = 6): void {
    if (this.isDevelopment) {
      log.info('UpdateManager: Skipping auto-check in development mode');
      return;
    }

    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates().catch((error) => {
        log.error('Auto update check failed:', error);
      });
    }, intervalMs);

    this.checkForUpdates().catch((error) => {
      log.error('Initial update check failed:', error);
    });
  }

  stopAutoCheckInterval(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }

  getUpdateInfo(): { currentVersion: string; platform: string } {
    return {
      currentVersion: app.getVersion(),
      platform: process.platform,
    };
  }
}
