import type { UpdateAdapter, UpdateInfo, UpdateProgress, UpdateError } from '../types';

const getAppVersion = (): string => {
  const version = import.meta.env['VITE_APP_VERSION'];
  return typeof version === 'string' ? version : '0.0.0';
};

type UpdateCallback = () => void;
type InfoCallback = (info: UpdateInfo) => void;
type ProgressCallback = (progress: UpdateProgress) => void;
type ErrorCallback = (error: UpdateError) => void;

const callbacks: {
  checking: UpdateCallback[];
  available: InfoCallback[];
  notAvailable: InfoCallback[];
  downloadProgress: ProgressCallback[];
  downloaded: InfoCallback[];
  error: ErrorCallback[];
} = {
  checking: [],
  available: [],
  notAvailable: [],
  downloadProgress: [],
  downloaded: [],
  error: [],
};

const notifyCallbacks = <T>(list: ((arg: T) => void)[], arg: T) => {
  list.forEach(cb => cb(arg));
};

export const createWebUpdateAdapter = (): UpdateAdapter => ({
  isSupported: () => 'serviceWorker' in navigator,

  checkForUpdates: async () => {
    if (!('serviceWorker' in navigator)) {
      return { success: false, error: 'Service Worker not supported' };
    }

    try {
      notifyCallbacks(callbacks.checking, undefined);

      const registration = await navigator.serviceWorker.ready;
      await registration.update();

      if (registration.waiting) {
        const info: UpdateInfo = { version: 'new' };
        notifyCallbacks(callbacks.available, info);
      } else {
        const info: UpdateInfo = { version: getAppVersion() };
        notifyCallbacks(callbacks.notAvailable, info);
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check for updates';
      notifyCallbacks(callbacks.error, { message });
      return { success: false, error: message };
    }
  },

  downloadUpdate: async () => {
    return { success: true };
  },

  installUpdate: async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }

      window.location.reload();
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to install update';
      return { success: false, error: message };
    }
  },

  getInfo: async () => ({
    currentVersion: getAppVersion(),
    platform: 'web',
  }),

  startAutoCheck: async () => ({ success: true }),

  stopAutoCheck: async () => ({ success: true }),

  onChecking: (callback: UpdateCallback) => {
    callbacks.checking.push(callback);
  },

  onAvailable: (callback: InfoCallback) => {
    callbacks.available.push(callback);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                callback({ version: 'new' });
              }
            });
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        const info: UpdateInfo = { version: 'new' };
        notifyCallbacks(callbacks.downloaded, info);
      });
    }
  },

  onNotAvailable: (callback: InfoCallback) => {
    callbacks.notAvailable.push(callback);
  },

  onDownloadProgress: (callback: ProgressCallback) => {
    callbacks.downloadProgress.push(callback);
  },

  onDownloaded: (callback: InfoCallback) => {
    callbacks.downloaded.push(callback);
  },

  onError: (callback: ErrorCallback) => {
    callbacks.error.push(callback);
  },
});
