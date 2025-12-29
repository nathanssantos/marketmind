import type { NotificationAdapter, NotificationOptions } from '../types';

export const createWebNotificationAdapter = (): NotificationAdapter => ({
  isSupported: async () => {
    return 'Notification' in window;
  },

  show: async (options: NotificationOptions) => {
    if (!('Notification' in window)) {
      return { success: false, error: 'Notifications not supported in this browser' };
    }

    try {
      if (Notification.permission === 'granted') {
        new Notification(options.title, {
          body: options.body,
          silent: options.silent ?? false,
        });
        return { success: true };
      }

      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(options.title, {
            body: options.body,
            silent: options.silent ?? false,
          });
          return { success: true };
        }
      }

      return { success: false, error: 'Notification permission denied' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to show notification';
      return { success: false, error: message };
    }
  },
});
