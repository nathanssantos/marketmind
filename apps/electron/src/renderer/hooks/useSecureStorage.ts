import { useCallback, useEffect, useState } from 'react';
import type { AIProvider } from '../adapters/types';
import { usePlatform } from '../context/PlatformContext';

interface UseSecureStorageResult {
  isEncryptionAvailable: boolean;
  loading: boolean;
  error: string | null;
  setApiKey: (provider: AIProvider, key: string) => Promise<boolean>;
  getApiKey: (provider: AIProvider) => Promise<string | null>;
  deleteApiKey: (provider: AIProvider) => Promise<boolean>;
  hasApiKey: (provider: AIProvider) => Promise<boolean>;
  getAllApiKeys: () => Promise<Record<string, boolean>>;
  clearAllApiKeys: () => Promise<boolean>;
}

export const useSecureStorage = (): UseSecureStorageResult => {
  const { storage } = usePlatform();
  const [isEncryptionAvailable, setIsEncryptionAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkEncryption = async () => {
      try {
        const available = await storage.isEncryptionAvailable();
        setIsEncryptionAvailable(available);
      } catch (err) {
        console.error('Failed to check encryption availability:', err);
        setIsEncryptionAvailable(false);
      }
    };

    checkEncryption();
  }, [storage]);

  const setApiKey = useCallback(async (provider: AIProvider, key: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const result = await storage.setApiKey(provider, key);

      if (!result.success) {
        setError(result.error || 'Failed to save API key');
        return false;
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [storage]);

  const getApiKey = useCallback(async (provider: AIProvider): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await storage.getApiKey(provider);

      if (!result.success) {
        setError(result.error || 'Failed to retrieve API key');
        return null;
      }

      return result.apiKey || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [storage]);

  const deleteApiKey = useCallback(async (provider: AIProvider): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const result = await storage.deleteApiKey(provider);

      if (!result.success) {
        setError(result.error || 'Failed to delete API key');
        return false;
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [storage]);

  const hasApiKey = useCallback(async (provider: AIProvider): Promise<boolean> => {
    try {
      return await storage.hasApiKey(provider);
    } catch (err) {
      console.error(`Failed to check if ${provider} API key exists:`, err);
      return false;
    }
  }, [storage]);

  const getAllApiKeys = useCallback(async (): Promise<Record<string, boolean>> => {
    try {
      return await storage.getAllApiKeys();
    } catch (err) {
      console.error('Failed to get all API keys:', err);
      return { openai: false, anthropic: false, gemini: false };
    }
  }, [storage]);

  const clearAllApiKeys = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const result = await storage.clearAllApiKeys();

      if (!result.success) {
        setError(result.error || 'Failed to clear API keys');
        return false;
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [storage]);

  return {
    isEncryptionAvailable,
    loading,
    error,
    setApiKey,
    getApiKey,
    deleteApiKey,
    hasApiKey,
    getAllApiKeys,
    clearAllApiKeys,
  };
};
