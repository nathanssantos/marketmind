type AIProvider = 'openai' | 'anthropic' | 'gemini';

const MIGRATION_KEY = 'marketmind-migrations-completed';
const LEGACY_AI_STORE_KEY = 'marketmind-ai-storage';

interface MigrationStatus {
  apiKeysMigrated: boolean;
  newsSettingsMigrated: boolean;
  version: string;
}

interface LegacyAISettings {
  provider?: string;
  apiKey?: string;
}

const getMigrationStatus = (): MigrationStatus => {
  try {
    const stored = localStorage.getItem(MIGRATION_KEY);
    return stored ? JSON.parse(stored) : { apiKeysMigrated: false, newsSettingsMigrated: false, version: '0.0.0' };
  } catch {
    return { apiKeysMigrated: false, newsSettingsMigrated: false, version: '0.0.0' };
  }
};

const setMigrationStatus = (status: MigrationStatus): void => {
  try {
    localStorage.setItem(MIGRATION_KEY, JSON.stringify(status));
  } catch (error) {
    console.error('Failed to save migration status:', error);
  }
};

const getLegacySettings = (): LegacyAISettings | null => {
  try {
    const stored = localStorage.getItem(LEGACY_AI_STORE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    return parsed?.state?.settings || null;
  } catch (error) {
    console.error('Failed to parse legacy settings:', error);
    return null;
  }
};

const migrateProviderKey = (provider: string | undefined): AIProvider | null => {
  if (!provider) return null;
  
  const normalized = provider.toLowerCase();
  if (normalized === 'openai') return 'openai';
  if (normalized === 'anthropic' || normalized === 'claude') return 'anthropic';
  if (normalized === 'gemini' || normalized === 'google') return 'gemini';
  
  return null;
};

export const migrateApiKeys = async (): Promise<boolean> => {
  const status = getMigrationStatus();
  
  if (status.apiKeysMigrated) {
    console.log('API keys already migrated');
    return true;
  }

  console.log('Starting API key migration...');

  try {
    const encryptionAvailable = await window.electron.secureStorage.isEncryptionAvailable();
    
    if (!encryptionAvailable) {
      console.warn('Encryption not available, skipping migration');
      return false;
    }

    const legacySettings = getLegacySettings();
    
    if (!legacySettings || !legacySettings.apiKey) {
      console.log('No legacy API key found');
      const currentStatus = getMigrationStatus();
      setMigrationStatus({ ...currentStatus, apiKeysMigrated: true });
      return true;
    }

    const provider = migrateProviderKey(legacySettings.provider);
    
    if (!provider) {
      console.warn('Unknown provider in legacy settings:', legacySettings.provider);
      const currentStatus = getMigrationStatus();
      setMigrationStatus({ ...currentStatus, apiKeysMigrated: true });
      return true;
    }

    const result = await window.electron.secureStorage.setApiKey(provider, legacySettings.apiKey);
    
    if (result.success) {
      console.log(`Successfully migrated ${provider} API key to secure storage`);
      
      try {
        const stored = localStorage.getItem(LEGACY_AI_STORE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.state?.settings) {
            delete parsed.state.settings.apiKey;
            localStorage.setItem(LEGACY_AI_STORE_KEY, JSON.stringify(parsed));
            console.log('Removed API key from localStorage');
          }
        }
      } catch (error) {
        console.error('Failed to cleanup legacy storage:', error);
      }
      
      const currentStatus = getMigrationStatus();
      setMigrationStatus({ ...currentStatus, apiKeysMigrated: true });
      return true;
    } else {
      console.error('Failed to migrate API key:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
};

export const migrateNewsSettings = async (): Promise<boolean> => {
  const status = getMigrationStatus();
  
  if (status.newsSettingsMigrated) {
    console.log('News settings already migrated');
    return true;
  }

  console.log('Starting news settings migration...');

  try {
    const encryptionAvailable = await window.electron.secureStorage.isEncryptionAvailable();
    
    if (!encryptionAvailable) {
      console.warn('Encryption not available, skipping news migration');
      return false;
    }

    const legacyNewsApiKey = localStorage.getItem('news_api_key');
    const legacyCryptoPanicKey = localStorage.getItem('cryptopanic_api_key');
    const legacyEnabled = localStorage.getItem('news_enabled');
    const legacyRefreshInterval = localStorage.getItem('news_refresh_interval');
    const legacyMaxArticles = localStorage.getItem('news_max_articles');

    let migrated = false;

    if (legacyNewsApiKey && legacyNewsApiKey.trim()) {
      const result = await window.electron.secureStorage.setApiKey('newsapi', legacyNewsApiKey.trim());
      if (result.success) {
        console.log('Migrated NewsAPI key to secure storage');
        migrated = true;
      }
    }

    if (legacyCryptoPanicKey && legacyCryptoPanicKey.trim()) {
      const result = await window.electron.secureStorage.setApiKey('cryptopanic', legacyCryptoPanicKey.trim());
      if (result.success) {
        console.log('Migrated CryptoPanic key to secure storage');
        migrated = true;
      }
    }

    if (legacyEnabled !== null || legacyRefreshInterval !== null || legacyMaxArticles !== null) {
      await window.electron.secureStorage.setNewsSettings({
        enabled: legacyEnabled === 'true',
        refreshInterval: parseInt(legacyRefreshInterval || '5', 10),
        maxArticles: parseInt(legacyMaxArticles || '10', 10),
      });
      console.log('Migrated news settings to secure storage');
      migrated = true;
    }

    if (migrated) {
      localStorage.removeItem('news_api_key');
      localStorage.removeItem('cryptopanic_api_key');
      localStorage.removeItem('news_enabled');
      localStorage.removeItem('news_refresh_interval');
      localStorage.removeItem('news_max_articles');
      console.log('Cleaned up legacy news settings from localStorage');
    }

    const currentStatus = getMigrationStatus();
    setMigrationStatus({ ...currentStatus, newsSettingsMigrated: true });
    
    console.log('News settings migration completed successfully');
    return true;
  } catch (error) {
    console.error('News settings migration failed:', error);
    return false;
  }
};

export const runMigrations = async (): Promise<void> => {
  console.log('Running migrations...');
  
  await migrateApiKeys();
  await migrateNewsSettings();
  
  console.log('Migrations completed');
};
