import type { PlatformAdapter, ZoomAdapter } from '../types';
import { createWebNotificationAdapter } from './notification';
import { createWebUpdateAdapter } from './update';
import { createWebWindowAdapter } from './window';
import { createWebHttpAdapter } from './http';

const createWebZoomAdapter = (): ZoomAdapter => ({
  setFactor: (factor) => { document.documentElement.style.zoom = String(factor); },
  getFactor: () => parseFloat(document.documentElement.style.zoom || '1'),
});

export const createWebAdapter = (): PlatformAdapter => ({
  update: createWebUpdateAdapter(),
  notification: createWebNotificationAdapter(),
  window: createWebWindowAdapter(),
  http: createWebHttpAdapter(),
  zoom: createWebZoomAdapter(),
  platform: 'web',
});
