import { useCallback, useEffect, useState } from 'react';
import type { UpdateInfo, UpdateProgress, UpdateError } from '../adapters/types';
import { usePlatform } from '../context/PlatformContext';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export const useAutoUpdate = () => {
  const { update } = usePlatform();
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState<UpdateError | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');

  useEffect(() => {
    if (!update.isSupported()) {
      setStatus('not-available');
      return;
    }

    const loadUpdateInfo = async () => {
      const info = await update.getInfo();
      setCurrentVersion(info.currentVersion);
    };

    void loadUpdateInfo();

    update.onChecking(() => {
      setStatus('checking');
      setError(null);
    });

    update.onAvailable((info) => {
      setStatus('available');
      setUpdateInfo(info);
    });

    update.onNotAvailable((info) => {
      setStatus('not-available');
      setUpdateInfo(info);
    });

    update.onDownloadProgress((progressInfo) => {
      setStatus('downloading');
      setProgress(progressInfo);
    });

    update.onDownloaded((info) => {
      setStatus('downloaded');
      setUpdateInfo(info);
      setProgress(null);
    });

    update.onError((errorInfo) => {
      setStatus('error');
      setError(errorInfo);
    });
  }, [update]);

  const checkForUpdates = useCallback(async () => {
    if (!update.isSupported()) return;
    const result = await update.checkForUpdates();
    if (!result.success) {
      setError({ message: result.error || 'Failed to check for updates' });
      setStatus('error');
    }
  }, [update]);

  const downloadUpdate = useCallback(async () => {
    if (!update.isSupported()) return;
    const result = await update.downloadUpdate();
    if (!result.success) {
      setError({ message: result.error || 'Failed to download update' });
      setStatus('error');
    }
  }, [update]);

  const installUpdate = useCallback(async () => {
    if (!update.isSupported()) return;
    const result = await update.installUpdate();
    if (!result.success) {
      setError({ message: result.error || 'Failed to install update' });
      setStatus('error');
    }
  }, [update]);

  const startAutoCheck = useCallback(async (intervalHours: number = 6) => {
    if (!update.isSupported()) return;
    const result = await update.startAutoCheck(intervalHours);
    if (!result.success) {
      console.error('Failed to start auto-check:', result.error);
    }
  }, [update]);

  const stopAutoCheck = useCallback(async () => {
    if (!update.isSupported()) return;
    const result = await update.stopAutoCheck();
    if (!result.success) {
      console.error('Failed to stop auto-check:', result.error);
    }
  }, [update]);

  return {
    status,
    updateInfo,
    progress,
    error,
    currentVersion,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    startAutoCheck,
    stopAutoCheck,
  };
};
