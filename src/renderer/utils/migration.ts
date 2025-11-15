type AIProvider = 'openai' | 'anthropic' | 'gemini';

const MIGRATION_KEY = 'marketmind-migrations-completed';
const LEGACY_AI_STORE_KEY = 'marketmind-ai-storage';

interface MigrationStatus {
  apiKeysMigrated: boolean;
  version: string;
}

interface LegacyAISettings {
  provider?: string;
  apiKey?: string;
}

const getMigrationStatus = (): MigrationStatus => {
  try {
    const stored = localStorage.getItem(MIGRATION_KEY);
    return stored ? JSON.parse(stored) : { apiKeysMigrated: false, version: '0.0.0' };
  } catch {
    return { apiKeysMigrated: false, version: '0.0.0' };
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
      setMigrationStatus({ apiKeysMigrated: true, version: '1.0.0' });
      return true;
    }

    const provider = migrateProviderKey(legacySettings.provider);
    
    if (!provider) {
      console.warn('Unknown provider in legacy settings:', legacySettings.provider);
      setMigrationStatus({ apiKeysMigrated: true, version: '1.0.0' });
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
      
      setMigrationStatus({ apiKeysMigrated: true, version: '1.0.0' });
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

export const runMigrations = async (): Promise<void> => {
  console.log('Running migrations...');
  
  await migrateApiKeys();
  
  console.log('Migrations completed');
};
