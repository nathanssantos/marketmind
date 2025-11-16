import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateApiKeys, migrateNewsSettings, runMigrations } from './migration';

const mockSecureStorage = {
  isEncryptionAvailable: vi.fn(),
  setApiKey: vi.fn(),
  setNewsSettings: vi.fn(),
};

describe('migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    (window as Window & typeof globalThis & { electron: unknown }).electron = {
      secureStorage: mockSecureStorage,
    } as never;
  });

  describe('migrateApiKeys', () => {
    it('should skip migration if already migrated', async () => {
      localStorage.setItem('marketmind-migrations-completed', JSON.stringify({
        apiKeysMigrated: true,
        newsSettingsMigrated: false,
        version: '0.8.0',
      }));

      const result = await migrateApiKeys();

      expect(result).toBe(true);
      expect(mockSecureStorage.isEncryptionAvailable).not.toHaveBeenCalled();
    });

    it('should skip migration if encryption not available', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(false);

      const result = await migrateApiKeys();

      expect(result).toBe(false);
      expect(mockSecureStorage.setApiKey).not.toHaveBeenCalled();
    });

    it('should mark as migrated if no legacy settings found', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);

      const result = await migrateApiKeys();

      expect(result).toBe(true);
      expect(mockSecureStorage.setApiKey).not.toHaveBeenCalled();
      
      const status = JSON.parse(localStorage.getItem('marketmind-migrations-completed') || '{}');
      expect(status.apiKeysMigrated).toBe(true);
    });

    it('should mark as migrated if no API key in legacy settings', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);
      localStorage.setItem('marketmind-ai-storage', JSON.stringify({
        state: {
          settings: {
            provider: 'openai',
          },
        },
      }));

      const result = await migrateApiKeys();

      expect(result).toBe(true);
      expect(mockSecureStorage.setApiKey).not.toHaveBeenCalled();
    });

    it('should migrate OpenAI API key', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);
      mockSecureStorage.setApiKey.mockResolvedValue({ success: true });
      
      localStorage.setItem('marketmind-ai-storage', JSON.stringify({
        state: {
          settings: {
            provider: 'openai',
            apiKey: 'sk-test-key',
          },
        },
      }));

      const result = await migrateApiKeys();

      expect(result).toBe(true);
      expect(mockSecureStorage.setApiKey).toHaveBeenCalledWith('openai', 'sk-test-key');
      
      const stored = JSON.parse(localStorage.getItem('marketmind-ai-storage') || '{}');
      expect(stored.state.settings.apiKey).toBeUndefined();
      
      const status = JSON.parse(localStorage.getItem('marketmind-migrations-completed') || '{}');
      expect(status.apiKeysMigrated).toBe(true);
    });

    it('should migrate Anthropic API key', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);
      mockSecureStorage.setApiKey.mockResolvedValue({ success: true });
      
      localStorage.setItem('marketmind-ai-storage', JSON.stringify({
        state: {
          settings: {
            provider: 'anthropic',
            apiKey: 'sk-ant-test',
          },
        },
      }));

      const result = await migrateApiKeys();

      expect(result).toBe(true);
      expect(mockSecureStorage.setApiKey).toHaveBeenCalledWith('anthropic', 'sk-ant-test');
    });

    it('should migrate Claude provider as Anthropic', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);
      mockSecureStorage.setApiKey.mockResolvedValue({ success: true });
      
      localStorage.setItem('marketmind-ai-storage', JSON.stringify({
        state: {
          settings: {
            provider: 'claude',
            apiKey: 'sk-ant-test',
          },
        },
      }));

      const result = await migrateApiKeys();

      expect(result).toBe(true);
      expect(mockSecureStorage.setApiKey).toHaveBeenCalledWith('anthropic', 'sk-ant-test');
    });

    it('should migrate Gemini API key', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);
      mockSecureStorage.setApiKey.mockResolvedValue({ success: true });
      
      localStorage.setItem('marketmind-ai-storage', JSON.stringify({
        state: {
          settings: {
            provider: 'gemini',
            apiKey: 'gemini-key',
          },
        },
      }));

      const result = await migrateApiKeys();

      expect(result).toBe(true);
      expect(mockSecureStorage.setApiKey).toHaveBeenCalledWith('gemini', 'gemini-key');
    });

    it('should migrate Google provider as Gemini', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);
      mockSecureStorage.setApiKey.mockResolvedValue({ success: true });
      
      localStorage.setItem('marketmind-ai-storage', JSON.stringify({
        state: {
          settings: {
            provider: 'google',
            apiKey: 'gemini-key',
          },
        },
      }));

      const result = await migrateApiKeys();

      expect(result).toBe(true);
      expect(mockSecureStorage.setApiKey).toHaveBeenCalledWith('gemini', 'gemini-key');
    });

    it('should handle unknown provider', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);
      
      localStorage.setItem('marketmind-ai-storage', JSON.stringify({
        state: {
          settings: {
            provider: 'unknown',
            apiKey: 'test-key',
          },
        },
      }));

      const result = await migrateApiKeys();

      expect(result).toBe(true);
      expect(mockSecureStorage.setApiKey).not.toHaveBeenCalled();
      
      const status = JSON.parse(localStorage.getItem('marketmind-migrations-completed') || '{}');
      expect(status.apiKeysMigrated).toBe(true);
    });

    it('should handle case-insensitive provider names', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);
      mockSecureStorage.setApiKey.mockResolvedValue({ success: true });
      
      localStorage.setItem('marketmind-ai-storage', JSON.stringify({
        state: {
          settings: {
            provider: 'OpenAI',
            apiKey: 'sk-test',
          },
        },
      }));

      const result = await migrateApiKeys();

      expect(result).toBe(true);
      expect(mockSecureStorage.setApiKey).toHaveBeenCalledWith('openai', 'sk-test');
    });

    it('should return false if setApiKey fails', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);
      mockSecureStorage.setApiKey.mockResolvedValue({ success: false, error: 'Encryption failed' });
      
      localStorage.setItem('marketmind-ai-storage', JSON.stringify({
        state: {
          settings: {
            provider: 'openai',
            apiKey: 'sk-test',
          },
        },
      }));

      const result = await migrateApiKeys();

      expect(result).toBe(false);
    });

    it('should handle corrupted legacy storage', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);
      localStorage.setItem('marketmind-ai-storage', 'invalid json');

      const result = await migrateApiKeys();

      expect(result).toBe(true);
      expect(mockSecureStorage.setApiKey).not.toHaveBeenCalled();
    });

    it('should handle migration error', async () => {
      mockSecureStorage.isEncryptionAvailable.mockRejectedValue(new Error('Test error'));

      const result = await migrateApiKeys();

      expect(result).toBe(false);
    });

    it('should handle cleanup error gracefully', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);
      mockSecureStorage.setApiKey.mockResolvedValue({ success: true });
      
      const invalidJson = '{"state":{"settings":{"provider":"openai","apiKey":"sk-test"}}}invalid';
      
      Object.defineProperty(localStorage, 'getItem', {
        value: vi.fn().mockImplementation((key: string) => {
          if (key === 'marketmind-ai-storage') return invalidJson;
          if (key === 'marketmind-migrations-completed') return null;
          return null;
        }),
        writable: true,
      });

      const result = await migrateApiKeys();

      expect(result).toBe(true);
    });
  });

  describe('migrateNewsSettings', () => {
    it('should skip migration if already migrated', async () => {
      localStorage.setItem('marketmind-migrations-completed', JSON.stringify({
        apiKeysMigrated: false,
        newsSettingsMigrated: true,
        version: '0.8.0',
      }));

      const result = await migrateNewsSettings();

      expect(result).toBe(true);
      expect(mockSecureStorage.isEncryptionAvailable).not.toHaveBeenCalled();
    });

    it('should skip migration if encryption not available', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(false);

      const result = await migrateNewsSettings();

      expect(result).toBe(false);
    });

    it('should migrate NewsAPI key', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);
      mockSecureStorage.setApiKey.mockResolvedValue({ success: true });
      
      localStorage.setItem('news_api_key', 'test-newsapi-key');

      const result = await migrateNewsSettings();

      expect(result).toBe(true);
      expect(mockSecureStorage.setApiKey).toHaveBeenCalledWith('newsapi', 'test-newsapi-key');
      expect(localStorage.getItem('news_api_key')).toBeNull();
    });

    it('should migrate CryptoPanic key', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);
      mockSecureStorage.setApiKey.mockResolvedValue({ success: true });
      
      localStorage.setItem('cryptopanic_api_key', 'test-cryptopanic-key');

      const result = await migrateNewsSettings();

      expect(result).toBe(true);
      expect(mockSecureStorage.setApiKey).toHaveBeenCalledWith('cryptopanic', 'test-cryptopanic-key');
      expect(localStorage.getItem('cryptopanic_api_key')).toBeNull();
    });

    it('should migrate both API keys', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);
      mockSecureStorage.setApiKey.mockResolvedValue({ success: true });
      
      localStorage.setItem('news_api_key', 'newsapi-key');
      localStorage.setItem('cryptopanic_api_key', 'cryptopanic-key');

      const result = await migrateNewsSettings();

      expect(result).toBe(true);
      expect(mockSecureStorage.setApiKey).toHaveBeenCalledWith('newsapi', 'newsapi-key');
      expect(mockSecureStorage.setApiKey).toHaveBeenCalledWith('cryptopanic', 'cryptopanic-key');
    });

    it('should migrate news settings', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);
      
      localStorage.setItem('news_enabled', 'true');
      localStorage.setItem('news_refresh_interval', '10');
      localStorage.setItem('news_max_articles', '20');

      const result = await migrateNewsSettings();

      expect(result).toBe(true);
      expect(mockSecureStorage.setNewsSettings).toHaveBeenCalledWith({
        enabled: true,
        refreshInterval: 10,
        maxArticles: 20,
      });
      expect(localStorage.getItem('news_enabled')).toBeNull();
      expect(localStorage.getItem('news_refresh_interval')).toBeNull();
      expect(localStorage.getItem('news_max_articles')).toBeNull();
    });

    it('should use default values for missing settings', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);
      
      localStorage.setItem('news_enabled', 'false');

      const result = await migrateNewsSettings();

      expect(result).toBe(true);
      expect(mockSecureStorage.setNewsSettings).toHaveBeenCalledWith({
        enabled: false,
        refreshInterval: 5,
        maxArticles: 10,
      });
    });

    it('should skip empty API keys', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);
      
      localStorage.setItem('news_api_key', '   ');
      localStorage.setItem('cryptopanic_api_key', '');

      const result = await migrateNewsSettings();

      expect(result).toBe(true);
      expect(mockSecureStorage.setApiKey).not.toHaveBeenCalled();
      
      const status = JSON.parse(localStorage.getItem('marketmind-migrations-completed') || '{}');
      expect(status.newsSettingsMigrated).toBe(true);
    });

    it('should handle migration error', async () => {
      mockSecureStorage.isEncryptionAvailable.mockRejectedValue(new Error('Test error'));

      const result = await migrateNewsSettings();

      expect(result).toBe(false);
    });

    it('should mark as migrated even with no legacy data', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);

      const result = await migrateNewsSettings();

      expect(result).toBe(true);
      
      const status = JSON.parse(localStorage.getItem('marketmind-migrations-completed') || '{}');
      expect(status.newsSettingsMigrated).toBe(true);
    });
  });

  describe('runMigrations', () => {
    it('should run all migrations', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(true);
      mockSecureStorage.setApiKey.mockResolvedValue({ success: true });
      
      localStorage.setItem('marketmind-ai-storage', JSON.stringify({
        state: {
          settings: {
            provider: 'openai',
            apiKey: 'sk-test',
          },
        },
      }));
      
      localStorage.setItem('news_api_key', 'news-key');

      await runMigrations();

      expect(mockSecureStorage.setApiKey).toHaveBeenCalledWith('openai', 'sk-test');
      expect(mockSecureStorage.setApiKey).toHaveBeenCalledWith('newsapi', 'news-key');
      
      const status = JSON.parse(localStorage.getItem('marketmind-migrations-completed') || '{}');
      expect(status.apiKeysMigrated).toBe(true);
      expect(status.newsSettingsMigrated).toBe(true);
    });

    it('should handle partial migration failures', async () => {
      mockSecureStorage.isEncryptionAvailable.mockResolvedValue(false);

      await runMigrations();

      const status = JSON.parse(localStorage.getItem('marketmind-migrations-completed') || '{}');
      expect(status.apiKeysMigrated).toBe(false);
      expect(status.newsSettingsMigrated).toBe(false);
      expect(status.movingAveragesMigrated).toBe(true);
    });
  });
});
