export interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

export interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface UpdateError {
  message: string;
  stack?: string;
}

export interface NotificationOptions {
  title: string;
  body: string;
  silent?: boolean;
  urgency?: 'normal' | 'critical' | 'low';
}

export interface HttpOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface UpdateAdapter {
  isSupported: () => boolean;
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

export interface NotificationAdapter {
  isSupported: () => Promise<boolean>;
  show: (options: NotificationOptions) => Promise<{ success: boolean; error?: string }>;
}

export interface WindowAdapter {
  openChart: (symbol?: string, timeframe?: string) => Promise<{ success: boolean; windowId?: number; error?: string }>;
  getChartWindows: () => Promise<number[]>;
}

export interface HttpAdapter {
  fetch: (url: string, options?: HttpOptions) => Promise<unknown>;
}

export interface PlatformAdapter {
  update: UpdateAdapter;
  notification: NotificationAdapter;
  window: WindowAdapter;
  http: HttpAdapter;
  platform: 'electron' | 'web';
}
