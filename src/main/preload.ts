import { contextBridge, ipcRenderer } from 'electron';

type AIProvider = 'openai' | 'anthropic' | 'gemini';

interface SecureStorageAPI {
  isEncryptionAvailable: () => Promise<boolean>;
  setApiKey: (provider: AIProvider, apiKey: string) => Promise<{ success: boolean; error?: string }>;
  getApiKey: (provider: AIProvider) => Promise<{ success: boolean; apiKey?: string | null; error?: string }>;
  deleteApiKey: (provider: AIProvider) => Promise<{ success: boolean; error?: string }>;
  hasApiKey: (provider: AIProvider) => Promise<boolean>;
  getAllApiKeys: () => Promise<Record<string, boolean>>;
  clearAllApiKeys: () => Promise<{ success: boolean; error?: string }>;
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
    
    setApiKey: async (provider: AIProvider, apiKey: string) => {
      return await ipcRenderer.invoke('storage:setApiKey', provider, apiKey);
    },
    
    getApiKey: async (provider: AIProvider) => {
      return await ipcRenderer.invoke('storage:getApiKey', provider);
    },
    
    deleteApiKey: async (provider: AIProvider) => {
      return await ipcRenderer.invoke('storage:deleteApiKey', provider);
    },
    
    hasApiKey: async (provider: AIProvider) => {
      return await ipcRenderer.invoke('storage:hasApiKey', provider);
    },

    getAllApiKeys: async () => {
      return await ipcRenderer.invoke('storage:getAllApiKeys');
    },

    clearAllApiKeys: async () => {
      return await ipcRenderer.invoke('storage:clearAllApiKeys');
    },
  } as SecureStorageAPI,
} as const;

contextBridge.exposeInMainWorld('electron', API);

export type ElectronAPI = typeof API;
