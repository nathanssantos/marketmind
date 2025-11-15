export class MigrationService {
  static async runMigrations(): Promise<void> {
    console.log('Migration system ready - migrations will run in renderer process');
  }
}
