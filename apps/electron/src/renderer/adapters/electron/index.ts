import type { PlatformAdapter, StorageAdapter, UpdateAdapter, NotificationAdapter, WindowAdapter, HttpAdapter } from '../types';

const createElectronStorageAdapter = (): StorageAdapter => ({
  isEncryptionAvailable: () => window.electron.secureStorage.isEncryptionAvailable(),
  setApiKey: (provider, apiKey) => window.electron.secureStorage.setApiKey(provider, apiKey),
  getApiKey: (provider) => window.electron.secureStorage.getApiKey(provider),
  deleteApiKey: (provider) => window.electron.secureStorage.deleteApiKey(provider),
  hasApiKey: (provider) => window.electron.secureStorage.hasApiKey(provider),
  getAllApiKeys: () => window.electron.secureStorage.getAllApiKeys(),
  clearAllApiKeys: () => window.electron.secureStorage.clearAllApiKeys(),
  getNewsSettings: () => window.electron.secureStorage.getNewsSettings(),
  setNewsSettings: (settings) => window.electron.secureStorage.setNewsSettings(settings),
  getTradingData: () => window.electron.secureStorage.getTradingData(),
  setTradingData: (data) => window.electron.secureStorage.setTradingData(data),
  clearTradingData: () => window.electron.secureStorage.clearTradingData(),
  getAIData: () => window.electron.secureStorage.getAIData(),
  setAIData: (data) => window.electron.secureStorage.setAIData(data),
  clearAIData: () => window.electron.secureStorage.clearAIData(),
  getAIPatterns: () => window.electron.secureStorage.getAIPatterns(),
  setAIPatterns: (patterns) => window.electron.secureStorage.setAIPatterns(patterns),
  getAIPatternsForSymbol: (symbol) => window.electron.secureStorage.getAIPatternsForSymbol(symbol),
  setAIPatternsForSymbol: (symbol, data) => window.electron.secureStorage.setAIPatternsForSymbol(symbol, data),
  deleteAIPatternsForSymbol: (symbol) => window.electron.secureStorage.deleteAIPatternsForSymbol(symbol),
  clearAIPatterns: () => window.electron.secureStorage.clearAIPatterns(),
});

const createElectronUpdateAdapter = (): UpdateAdapter => ({
  isSupported: () => true,
  checkForUpdates: () => window.electron.update.checkForUpdates(),
  downloadUpdate: () => window.electron.update.downloadUpdate(),
  installUpdate: () => window.electron.update.installUpdate(),
  getInfo: () => window.electron.update.getInfo(),
  startAutoCheck: (intervalHours) => window.electron.update.startAutoCheck(intervalHours),
  stopAutoCheck: () => window.electron.update.stopAutoCheck(),
  onChecking: (callback) => window.electron.update.onChecking(callback),
  onAvailable: (callback) => window.electron.update.onAvailable(callback),
  onNotAvailable: (callback) => window.electron.update.onNotAvailable(callback),
  onDownloadProgress: (callback) => window.electron.update.onDownloadProgress(callback),
  onDownloaded: (callback) => window.electron.update.onDownloaded(callback),
  onError: (callback) => window.electron.update.onError(callback),
});

const createElectronNotificationAdapter = (): NotificationAdapter => ({
  isSupported: () => window.electron.notification.isSupported(),
  show: (options) => window.electron.notification.show(options),
});

const createElectronWindowAdapter = (): WindowAdapter => ({
  openChart: (symbol, timeframe) => window.electron.window.openChart(symbol, timeframe),
  getChartWindows: () => window.electron.window.getChartWindows(),
});

const createElectronHttpAdapter = (): HttpAdapter => ({
  fetch: (url, options) => window.electron.http.fetch(url, options),
});

export const createElectronAdapter = (): PlatformAdapter => ({
  storage: createElectronStorageAdapter(),
  update: createElectronUpdateAdapter(),
  notification: createElectronNotificationAdapter(),
  window: createElectronWindowAdapter(),
  http: createElectronHttpAdapter(),
  platform: 'electron',
});
