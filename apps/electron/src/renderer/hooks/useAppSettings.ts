import { useEffect, useState } from 'react';

interface AppSettings {
  newsCorrelateWithAI: boolean;
  calendarCorrelateWithAI: boolean;
  newsRefreshInterval: number;
  newsMaxArticles: number;
  newsEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  newsCorrelateWithAI: false,
  calendarCorrelateWithAI: false,
  newsRefreshInterval: 5 * 60 * 1000,
  newsMaxArticles: 10,
  newsEnabled: true,
};

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [newsSettings, calendarSettings] = await Promise.all([
          window.electron.secureStorage.getNewsSettings().catch(() => null),
          (async () => {
            const stored = localStorage.getItem('marketmind-calendar-settings');
            return stored ? JSON.parse(stored) : null;
          })(),
        ]);

        setSettings({
          newsCorrelateWithAI: (newsSettings as typeof newsSettings & { correlateWithAI?: boolean })?.correlateWithAI ?? false,
          calendarCorrelateWithAI: calendarSettings?.correlateWithAI ?? false,
          newsRefreshInterval: newsSettings?.refreshInterval ?? DEFAULT_SETTINGS.newsRefreshInterval,
          newsMaxArticles: newsSettings?.maxArticles ?? DEFAULT_SETTINGS.newsMaxArticles,
          newsEnabled: newsSettings?.enabled ?? DEFAULT_SETTINGS.newsEnabled,
        });
      } catch (error) {
        console.error('Failed to load app settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  return { settings, loading };
};
