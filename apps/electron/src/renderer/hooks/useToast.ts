import type { MarketType } from '@marketmind/types';
import { useCallback } from 'react';
import { useUIPref } from '../store/preferencesStore';
import { playNotificationSound } from '../utils/notificationSound';
import { toaster } from '../utils/toaster';

export interface ToastMeta {
  symbol?: string;
  marketType?: MarketType;
}

export interface ToastOptions {
  title: string;
  description?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number | null;
  meta?: ToastMeta;
}

export const useToast = () => {
  const [soundEnabled] = useUIPref<boolean>('notificationSoundEnabled', false);

  const showToast = useCallback((options: ToastOptions) => {
    queueMicrotask(() => {
      toaster.create({
        title: options.title,
        description: options.description,
        type: options.type ?? 'info',
        duration: options.duration === null ? undefined : (options.duration ?? 3000),
        meta: options.meta,
      });
      if (soundEnabled) {
        playNotificationSound(options.type ?? 'info');
      }
    });
  }, [soundEnabled]);

  const success = useCallback((title: string, description?: string, meta?: ToastMeta) => {
    showToast({ title, ...(description && { description }), type: 'success', meta });
  }, [showToast]);

  const error = useCallback((title: string, description?: string, meta?: ToastMeta) => {
    showToast({ title, ...(description && { description }), type: 'error', duration: 5000, meta });
  }, [showToast]);

  const warning = useCallback((title: string, description?: string, meta?: ToastMeta) => {
    showToast({ title, ...(description && { description }), type: 'warning', meta });
  }, [showToast]);

  const info = useCallback((title: string, description?: string, meta?: ToastMeta) => {
    showToast({ title, ...(description && { description }), type: 'info', meta });
  }, [showToast]);

  const persistentSuccess = useCallback((title: string, description?: string, meta?: ToastMeta) => {
    showToast({ title, ...(description && { description }), type: 'success', duration: null, meta });
  }, [showToast]);

  const persistentError = useCallback((title: string, description?: string, meta?: ToastMeta) => {
    showToast({ title, ...(description && { description }), type: 'error', duration: null, meta });
  }, [showToast]);

  const persistentWarning = useCallback((title: string, description?: string, meta?: ToastMeta) => {
    showToast({ title, ...(description && { description }), type: 'warning', duration: null, meta });
  }, [showToast]);

  const persistentInfo = useCallback((title: string, description?: string, meta?: ToastMeta) => {
    showToast({ title, ...(description && { description }), type: 'info', duration: null, meta });
  }, [showToast]);

  return {
    showToast,
    success,
    error,
    warning,
    info,
    persistentSuccess,
    persistentError,
    persistentWarning,
    persistentInfo,
  };
};
