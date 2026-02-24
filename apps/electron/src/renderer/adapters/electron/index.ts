import type { PlatformAdapter, UpdateAdapter, NotificationAdapter, WindowAdapter, HttpAdapter, ZoomAdapter } from '../types';

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

const createElectronZoomAdapter = (): ZoomAdapter => ({
  setFactor: (factor) => window.electron.zoom.setFactor(factor),
  getFactor: () => window.electron.zoom.getFactor(),
});

export const createElectronAdapter = (): PlatformAdapter => ({
  update: createElectronUpdateAdapter(),
  notification: createElectronNotificationAdapter(),
  window: createElectronWindowAdapter(),
  http: createElectronHttpAdapter(),
  zoom: createElectronZoomAdapter(),
  platform: 'electron',
});
