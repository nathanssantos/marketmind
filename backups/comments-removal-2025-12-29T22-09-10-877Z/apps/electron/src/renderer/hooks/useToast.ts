import { useCallback } from 'react';
import { toaster } from '../utils/toaster';

export interface ToastOptions {
  title: string;
  description?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number | null;
}

export const useToast = () => {
  const showToast = useCallback((options: ToastOptions) => {
    queueMicrotask(() => {
      toaster.create({
        title: options.title,
        description: options.description,
        type: options.type || 'info',
        duration: options.duration === null ? undefined : (options.duration || 5000),
      });
    });
  }, []);

  const success = useCallback((title: string, description?: string) => {
    showToast({ title, ...(description && { description }), type: 'success' });
  }, [showToast]);

  const error = useCallback((title: string, description?: string) => {
    showToast({ title, ...(description && { description }), type: 'error', duration: 8000 });
  }, [showToast]);

  const warning = useCallback((title: string, description?: string) => {
    showToast({ title, ...(description && { description }), type: 'warning' });
  }, [showToast]);

  const info = useCallback((title: string, description?: string) => {
    showToast({ title, ...(description && { description }), type: 'info' });
  }, [showToast]);

  const persistentSuccess = useCallback((title: string, description?: string) => {
    showToast({ title, ...(description && { description }), type: 'success', duration: null });
  }, [showToast]);

  const persistentError = useCallback((title: string, description?: string) => {
    showToast({ title, ...(description && { description }), type: 'error', duration: null });
  }, [showToast]);

  const persistentWarning = useCallback((title: string, description?: string) => {
    showToast({ title, ...(description && { description }), type: 'warning', duration: null });
  }, [showToast]);

  const persistentInfo = useCallback((title: string, description?: string) => {
    showToast({ title, ...(description && { description }), type: 'info', duration: null });
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
