import { useCallback, useEffect, useState } from 'react';

interface EmbeddedDataDir {
  dataDir: string | null;
  openDataDir: () => Promise<void>;
}

const electronApp = (): Window['electron']['app'] | undefined =>
  typeof window === 'undefined' ? undefined : window.electron?.app;

export const useEmbeddedDataDir = (): EmbeddedDataDir => {
  const [dataDir, setDataDir] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void electronApp()?.getDataDir().then((dir) => {
      if (!cancelled) setDataDir(dir);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openDataDir = useCallback(async () => {
    await electronApp()?.openDataDir();
  }, []);

  return { dataDir, openDataDir };
};
