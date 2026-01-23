import { contextBridge, ipcRenderer } from 'electron';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

interface UpdateError {
  message: string;
  stack?: string;
}

interface NotificationOptions {
  title: string;
  body: string;
  silent?: boolean;
  urgency?: 'normal' | 'critical' | 'low';
}

interface NotificationAPI {
  show: (options: NotificationOptions) => Promise<{ success: boolean; error?: string }>;
  isSupported: () => Promise<boolean>;
}

interface WindowAPI {
  openChart: (symbol?: string, timeframe?: string) => Promise<{ success: boolean; windowId?: number; error?: string }>;
  getChartWindows: () => Promise<number[]>;
}

interface UpdateAPI {
  checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => Promise<{ success: boolean; error?: string }>;
  getInfo: () => Promise<{ currentVersion: string; platform: string }>;
  startAutoCheck: (intervalHours: number) => Promise<{ success: boolean; error?: string }>;
  stopAutoCheck: () => Promise<{ success: boolean; error?: string }>;
  onChecking: (callback: () => void) => void;
  onAvailable: (callback: (info: UpdateInfo) => void) => void;
  onNotAvailable: (callback: (info: UpdateInfo) => void) => void;
  onDownloadProgress: (callback: (progress: UpdateProgress) => void) => void;
  onDownloaded: (callback: (info: UpdateInfo) => void) => void;
  onError: (callback: (error: UpdateError) => void) => void;
}

const API = {
  send: (channel: string, data: unknown) => {
    ipcRenderer.send(channel, data);
  },

  on: (channel: string, callback: (data: unknown) => void) => {
    ipcRenderer.on(channel, (_event, data) => callback(data));
  },

  invoke: async (channel: string, data?: unknown) => {
    return await ipcRenderer.invoke(channel, data);
  },

  update: {
    checkForUpdates: async () => {
      return await ipcRenderer.invoke('update:check');
    },

    downloadUpdate: async () => {
      return await ipcRenderer.invoke('update:download');
    },

    installUpdate: async () => {
      return await ipcRenderer.invoke('update:install');
    },

    getInfo: async () => {
      return await ipcRenderer.invoke('update:getInfo');
    },

    startAutoCheck: async (intervalHours: number) => {
      return await ipcRenderer.invoke('update:startAutoCheck', intervalHours);
    },

    stopAutoCheck: async () => {
      return await ipcRenderer.invoke('update:stopAutoCheck');
    },

    onChecking: (callback: () => void) => {
      ipcRenderer.on('update:checking', () => callback());
    },

    onAvailable: (callback: (info: UpdateInfo) => void) => {
      ipcRenderer.on('update:available', (_event, info) => callback(info));
    },

    onNotAvailable: (callback: (info: UpdateInfo) => void) => {
      ipcRenderer.on('update:not-available', (_event, info) => callback(info));
    },

    onDownloadProgress: (callback: (progress: UpdateProgress) => void) => {
      ipcRenderer.on('update:download-progress', (_event, progress) => callback(progress));
    },

    onDownloaded: (callback: (info: UpdateInfo) => void) => {
      ipcRenderer.on('update:downloaded', (_event, info) => callback(info));
    },

    onError: (callback: (error: UpdateError) => void) => {
      ipcRenderer.on('update:error', (_event, error) => callback(error));
    },
  } as UpdateAPI,

  http: {
    fetch: async (url: string, options?: { method?: string; headers?: Record<string, string>; body?: unknown }) => {
      return await ipcRenderer.invoke('http:fetch', url, options);
    },
  },

  notification: {
    show: async (options: NotificationOptions) => {
      return await ipcRenderer.invoke('notification:show', options);
    },

    isSupported: async () => {
      return await ipcRenderer.invoke('notification:isSupported');
    },
  } as NotificationAPI,

  window: {
    openChart: async (symbol?: string, timeframe?: string) => {
      return await ipcRenderer.invoke('window:openChart', symbol, timeframe);
    },

    getChartWindows: async () => {
      return await ipcRenderer.invoke('window:getChartWindows');
    },
  } as WindowAPI,
} as const;

contextBridge.exposeInMainWorld('electron', API);

export type ElectronAPI = typeof API;
