import { useCallback, useEffect, useState } from 'react';

interface NotificationOptions {
  title: string;
  body: string;
  silent?: boolean;
  urgency?: 'normal' | 'critical' | 'low';
}

interface UseNotificationReturn {
  showNotification: (options: NotificationOptions) => Promise<void>;
  isSupported: boolean;
  error: string | null;
}

export const useNotification = (): UseNotificationReturn => {
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSupport = async () => {
      try {
        const supported = await window.electron.notification.isSupported();
        setIsSupported(supported);
      } catch (err) {
        console.error('Failed to check notification support:', err);
        setIsSupported(false);
      }
    };

    checkSupport();
  }, []);

  const showNotification = useCallback(async (options: NotificationOptions) => {
    setError(null);

    if (!isSupported) {
      const errorMsg = 'Notifications are not supported on this system';
      setError(errorMsg);
      console.warn(errorMsg);
      return;
    }

    try {
      const result = await window.electron.notification.show(options);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to show notification');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to show notification';
      setError(errorMsg);
      console.error('Notification error:', err);
    }
  }, [isSupported]);

  return {
    showNotification,
    isSupported,
    error,
  };
};
