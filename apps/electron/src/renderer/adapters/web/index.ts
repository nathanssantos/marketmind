import type { PlatformAdapter } from '../types';
import { createWebNotificationAdapter } from './notification';
import { createWebUpdateAdapter } from './update';
import { createWebWindowAdapter } from './window';
import { createWebHttpAdapter } from './http';

export const createWebAdapter = (): PlatformAdapter => ({
  update: createWebUpdateAdapter(),
  notification: createWebNotificationAdapter(),
  window: createWebWindowAdapter(),
  http: createWebHttpAdapter(),
  platform: 'web',
});
