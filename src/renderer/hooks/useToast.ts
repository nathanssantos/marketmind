import { useCallback } from 'react';
import { toaster } from '../utils/toaster';

export interface ToastOptions {
  title: string;
  description?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export const useToast = () => {
  const showToast = useCallback((options: ToastOptions) => {
    console.log('[useToast] Creating toast:', options);
    toaster.create({
      title: options.title,
      description: options.description,
      type: options.type || 'info',
      duration: options.duration || 5000,
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

  return {
    showToast,
    success,
    error,
    warning,
    info,
  };
};
