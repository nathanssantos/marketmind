import { contextBridge, ipcRenderer, webFrame } from 'electron';

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
  },

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
  },

  window: {
    openChart: async (symbol?: string, timeframe?: string) => {
      return await ipcRenderer.invoke('window:openChart', symbol, timeframe);
    },

    getChartWindows: async () => {
      return await ipcRenderer.invoke('window:getChartWindows');
    },
  },

  zoom: {
    setFactor: (factor: number) => { webFrame.setZoomFactor(factor); },
    getFactor: () => webFrame.getZoomFactor(),
  },
} as const;

contextBridge.exposeInMainWorld('electron', API);

export type ElectronAPI = typeof API;
