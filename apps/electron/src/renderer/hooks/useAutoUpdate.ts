import { useState, useEffect, useCallback } from 'react';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

interface UpdateError {
  message: string;
  stack?: string;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export const useAutoUpdate = () => {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState<UpdateError | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');

  useEffect(() => {
    const loadUpdateInfo = async () => {
      const info = await window.electron.update.getInfo();
      setCurrentVersion(info.currentVersion);
    };

    loadUpdateInfo();

    window.electron.update.onChecking(() => {
      setStatus('checking');
      setError(null);
    });

    window.electron.update.onAvailable((info) => {
      setStatus('available');
      setUpdateInfo(info);
    });

    window.electron.update.onNotAvailable((info) => {
      setStatus('not-available');
      setUpdateInfo(info);
    });

    window.electron.update.onDownloadProgress((progressInfo) => {
      setStatus('downloading');
      setProgress(progressInfo);
    });

    window.electron.update.onDownloaded((info) => {
      setStatus('downloaded');
      setUpdateInfo(info);
      setProgress(null);
    });

    window.electron.update.onError((errorInfo) => {
      setStatus('error');
      setError(errorInfo);
    });
  }, []);

  const checkForUpdates = useCallback(async () => {
    const result = await window.electron.update.checkForUpdates();
    if (!result.success) {
      setError({ message: result.error || 'Failed to check for updates' });
      setStatus('error');
    }
  }, []);

  const downloadUpdate = useCallback(async () => {
    const result = await window.electron.update.downloadUpdate();
    if (!result.success) {
      setError({ message: result.error || 'Failed to download update' });
      setStatus('error');
    }
  }, []);

  const installUpdate = useCallback(async () => {
    const result = await window.electron.update.installUpdate();
    if (!result.success) {
      setError({ message: result.error || 'Failed to install update' });
      setStatus('error');
    }
  }, []);

  const startAutoCheck = useCallback(async (intervalHours: number = 6) => {
    const result = await window.electron.update.startAutoCheck(intervalHours);
    if (!result.success) {
      console.error('Failed to start auto-check:', result.error);
    }
  }, []);

  const stopAutoCheck = useCallback(async () => {
    const result = await window.electron.update.stopAutoCheck();
    if (!result.success) {
      console.error('Failed to stop auto-check:', result.error);
    }
  }, []);

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
