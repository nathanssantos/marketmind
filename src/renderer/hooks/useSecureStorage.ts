import { useState, useEffect, useCallback } from 'react';

type AIProvider = 'openai' | 'anthropic' | 'gemini';

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
  const [isEncryptionAvailable, setIsEncryptionAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkEncryption = async () => {
      try {
        const available = await window.electron.secureStorage.isEncryptionAvailable();
        setIsEncryptionAvailable(available);
      } catch (err) {
        console.error('Failed to check encryption availability:', err);
        setIsEncryptionAvailable(false);
      }
    };

    checkEncryption();
  }, []);

  const setApiKey = useCallback(async (provider: AIProvider, key: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.electron.secureStorage.setApiKey(provider, key);
      
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
  }, []);

  const getApiKey = useCallback(async (provider: AIProvider): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.electron.secureStorage.getApiKey(provider);
      
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
  }, []);

  const deleteApiKey = useCallback(async (provider: AIProvider): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.electron.secureStorage.deleteApiKey(provider);
      
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
  }, []);

  const hasApiKey = useCallback(async (provider: AIProvider): Promise<boolean> => {
    try {
      return await window.electron.secureStorage.hasApiKey(provider);
    } catch (err) {
      console.error(`Failed to check if ${provider} API key exists:`, err);
      return false;
    }
  }, []);

  const getAllApiKeys = useCallback(async (): Promise<Record<string, boolean>> => {
    try {
      return await window.electron.secureStorage.getAllApiKeys();
    } catch (err) {
      console.error('Failed to get all API keys:', err);
      return { openai: false, anthropic: false, gemini: false };
    }
  }, []);

  const clearAllApiKeys = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.electron.secureStorage.clearAllApiKeys();
      
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
  }, []);

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

