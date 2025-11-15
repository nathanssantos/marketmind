import { contextBridge, ipcRenderer } from 'electron';

interface SecureStorageAPI {
  isEncryptionAvailable: () => Promise<boolean>;
  setApiKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
  getApiKey: () => Promise<{ success: boolean; apiKey?: string | null; error?: string }>;
  deleteApiKey: () => Promise<{ success: boolean; error?: string }>;
  hasApiKey: () => Promise<boolean>;
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
    
    setApiKey: async (apiKey: string) => {
      return await ipcRenderer.invoke('storage:setApiKey', apiKey);
    },
    
    getApiKey: async () => {
      return await ipcRenderer.invoke('storage:getApiKey');
    },
    
    deleteApiKey: async () => {
      return await ipcRenderer.invoke('storage:deleteApiKey');
    },
    
    hasApiKey: async () => {
      return await ipcRenderer.invoke('storage:hasApiKey');
    },
  } as SecureStorageAPI,
} as const;

contextBridge.exposeInMainWorld('electron', API);

export type ElectronAPI = typeof API;
