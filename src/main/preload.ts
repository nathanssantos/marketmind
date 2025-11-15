import { contextBridge, ipcRenderer } from 'electron';

type AIProvider = 'openai' | 'anthropic' | 'gemini';
type NewsProvider = 'newsapi' | 'cryptopanic';

interface SecureStorageAPI {
  isEncryptionAvailable: () => Promise<boolean>;
  setApiKey: (provider: AIProvider | NewsProvider, apiKey: string) => Promise<{ success: boolean; error?: string }>;
  getApiKey: (provider: AIProvider | NewsProvider) => Promise<{ success: boolean; apiKey?: string | null; error?: string }>;
  deleteApiKey: (provider: AIProvider | NewsProvider) => Promise<{ success: boolean; error?: string }>;
  hasApiKey: (provider: AIProvider | NewsProvider) => Promise<boolean>;
  getAllApiKeys: () => Promise<Record<string, boolean>>;
  clearAllApiKeys: () => Promise<{ success: boolean; error?: string }>;
  getNewsSettings: () => Promise<{ enabled: boolean; refreshInterval: number; maxArticles: number }>;
  setNewsSettings: (settings: { enabled: boolean; refreshInterval: number; maxArticles: number }) => Promise<{ success: boolean; error?: string }>;
}

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

  secureStorage: {
    isEncryptionAvailable: async () => {
      return await ipcRenderer.invoke('storage:isEncryptionAvailable');
    },
    
    setApiKey: async (provider: AIProvider | NewsProvider, apiKey: string) => {
      return await ipcRenderer.invoke('storage:setApiKey', provider, apiKey);
    },
    
    getApiKey: async (provider: AIProvider | NewsProvider) => {
      return await ipcRenderer.invoke('storage:getApiKey', provider);
    },
    
    deleteApiKey: async (provider: AIProvider | NewsProvider) => {
      return await ipcRenderer.invoke('storage:deleteApiKey', provider);
    },
    
    hasApiKey: async (provider: AIProvider | NewsProvider) => {
      return await ipcRenderer.invoke('storage:hasApiKey', provider);
    },

    getAllApiKeys: async () => {
      return await ipcRenderer.invoke('storage:getAllApiKeys');
    },

    clearAllApiKeys: async () => {
      return await ipcRenderer.invoke('storage:clearAllApiKeys');
    },
    
    getNewsSettings: async () => {
      return await ipcRenderer.invoke('storage:getNewsSettings');
    },

    setNewsSettings: async (settings: { enabled: boolean; refreshInterval: number; maxArticles: number }) => {
      return await ipcRenderer.invoke('storage:setNewsSettings', settings);
    },
  } as SecureStorageAPI,

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
} as const;

contextBridge.exposeInMainWorld('electron', API);

export type ElectronAPI = typeof API;
