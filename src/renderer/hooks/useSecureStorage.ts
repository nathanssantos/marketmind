import { useState, useEffect, useCallback } from 'react';

interface UseSecureStorageResult {
  apiKey: string | null;
  isLoading: boolean;
  error: string | null;
  isEncryptionAvailable: boolean;
  setApiKey: (key: string) => Promise<void>;
  deleteApiKey: () => Promise<void>;
  refreshApiKey: () => Promise<void>;
}

export const useSecureStorage = (): UseSecureStorageResult => {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEncryptionAvailable, setIsEncryptionAvailable] = useState(false);

  useEffect(() => {
    const loadApiKey = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const encryptionAvailable = await window.electron.secureStorage.isEncryptionAvailable();
        setIsEncryptionAvailable(encryptionAvailable);

        if (!encryptionAvailable) {
          setError('Encryption is not available on this platform');
          return;
        }

        const result = await window.electron.secureStorage.getApiKey();
        
        if (result.success) {
          setApiKeyState(result.apiKey || null);
        } else {
          setError(result.error || 'Failed to load API key');
        }
      } catch (err) {
        console.error('Failed to load API key:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    loadApiKey();
  }, []);

  const setApiKey = useCallback(async (key: string) => {
    try {
      setError(null);
      
      const result = await window.electron.secureStorage.setApiKey(key);
      
      if (result.success) {
        setApiKeyState(key);
      } else {
        throw new Error(result.error || 'Failed to save API key');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const deleteApiKey = useCallback(async () => {
    try {
      setError(null);
      
      const result = await window.electron.secureStorage.deleteApiKey();
      
      if (result.success) {
        setApiKeyState(null);
      } else {
        throw new Error(result.error || 'Failed to delete API key');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const refreshApiKey = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await window.electron.secureStorage.getApiKey();
      
      if (result.success) {
        setApiKeyState(result.apiKey || null);
      } else {
        throw new Error(result.error || 'Failed to refresh API key');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    apiKey,
    isLoading,
    error,
    isEncryptionAvailable,
    setApiKey,
    deleteApiKey,
    refreshApiKey,
  };
};
