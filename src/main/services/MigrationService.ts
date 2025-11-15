import { storageService } from './StorageService';

interface LegacyAIStorage {
  state?: {
    settings?: {
      apiKey?: string;
    };
  };
}

export class MigrationService {
  private static MIGRATION_KEY = 'migration-version';
  private static CURRENT_VERSION = 1;
  private static LEGACY_STORAGE_KEY = 'marketmind-ai-storage';

  static needsMigration(): boolean {
    const currentVersion = this.getMigrationVersion();
    return currentVersion < this.CURRENT_VERSION;
  }

  private static getMigrationVersion(): number {
    try {
      const stored = localStorage.getItem(this.MIGRATION_KEY);
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  }

  private static setMigrationVersion(version: number): void {
    try {
      localStorage.setItem(this.MIGRATION_KEY, version.toString());
    } catch (error) {
      console.error('Failed to set migration version:', error);
    }
  }

  static async migrateApiKey(): Promise<boolean> {
    try {
      const legacyData = localStorage.getItem(this.LEGACY_STORAGE_KEY);
      
      if (!legacyData) {
        console.log('No legacy data found, skipping API key migration');
        return true;
      }

      const parsed: LegacyAIStorage = JSON.parse(legacyData);
      const apiKey = parsed?.state?.settings?.apiKey;

      if (!apiKey || typeof apiKey !== 'string') {
        console.log('No API key found in legacy data');
        return true;
      }

      if (!storageService.isEncryptionAvailable()) {
        console.error('Encryption not available, cannot migrate API key');
        return false;
      }

      storageService.setApiKey(apiKey);
      console.log('Successfully migrated API key to secure storage');

      const updatedData = {
        ...parsed,
        state: {
          ...parsed.state,
          settings: {
            ...parsed.state?.settings,
            apiKey: undefined,
          },
        },
      };

      localStorage.setItem(this.LEGACY_STORAGE_KEY, JSON.stringify(updatedData));
      console.log('Removed API key from localStorage');

      return true;
    } catch (error) {
      console.error('Failed to migrate API key:', error);
      return false;
    }
  }

  static async runMigrations(): Promise<void> {
    if (!this.needsMigration()) {
      console.log('No migrations needed');
      return;
    }

    console.log('Running migrations...');

    const currentVersion = this.getMigrationVersion();

    if (currentVersion < 1) {
      console.log('Running migration v0 -> v1: API key to secure storage');
      const success = await this.migrateApiKey();
      
      if (success) {
        this.setMigrationVersion(1);
        console.log('Migration v0 -> v1 completed successfully');
      } else {
        console.error('Migration v0 -> v1 failed');
        throw new Error('Migration failed');
      }
    }

    console.log('All migrations completed');
  }
}
