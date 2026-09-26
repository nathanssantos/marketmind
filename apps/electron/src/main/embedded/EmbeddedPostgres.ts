import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  connectionString,
  initdbArgs,
  pgCtlStartArgs,
  pgCtlStatusArgs,
  pgCtlStopArgs,
  postgresExecutable,
  type PostgresLocation,
} from './postgresArgs';

const execFileAsync = promisify(execFile);

const PG_VERSION_FILE = 'PG_VERSION';
const OWNER_READ_WRITE = 0o600;
const PG_CTL_NOT_RUNNING_EXIT_CODE = 3;

export interface EmbeddedPostgresOptions extends PostgresLocation {
  port: number;
  user: string;
  password: string;
  database: string;
  log: (line: string) => void;
}

export class EmbeddedPostgres {
  private readonly options: EmbeddedPostgresOptions;

  constructor(options: EmbeddedPostgresOptions) {
    this.options = options;
  }

  get connectionUrl(): string {
    const { user, password, port, database } = this.options;
    return connectionString({ user, password, port, database });
  }

  get isInitialized(): boolean {
    return existsSync(path.join(this.options.dataDir, PG_VERSION_FILE));
  }

  async start(): Promise<void> {
    mkdirSync(path.dirname(this.options.logFile), { recursive: true });
    if (!this.isInitialized) await this.initialize();
    if (await this.isRunning()) await this.stop();
    const { dataDir, logFile, port } = this.options;
    this.options.log(`postgres: starting on port ${port}`);
    await this.run('pg_ctl', pgCtlStartArgs({ dataDir, logFile, port }));
  }

  async stop(): Promise<void> {
    if (!(await this.isRunning())) return;
    this.options.log('postgres: stopping');
    await this.run('pg_ctl', pgCtlStopArgs(this.options.dataDir));
  }

  private async initialize(): Promise<void> {
    const { dataDir, user, password } = this.options;
    this.options.log(`postgres: initializing data directory ${dataDir}`);
    mkdirSync(path.dirname(dataDir), { recursive: true });
    const passwordFile = path.join(path.dirname(dataDir), 'postgres-password.tmp');
    writeFileSync(passwordFile, `${password}\n`, { mode: OWNER_READ_WRITE });
    try {
      await this.run('initdb', initdbArgs({ dataDir, user, passwordFile }));
    } finally {
      rmSync(passwordFile, { force: true });
    }
  }

  private async isRunning(): Promise<boolean> {
    if (!this.isInitialized) return false;
    try {
      await this.run('pg_ctl', pgCtlStatusArgs(this.options.dataDir));
      return true;
    } catch (error) {
      const exitCode = (error as { code?: number }).code;
      if (exitCode === PG_CTL_NOT_RUNNING_EXIT_CODE) return false;
      if (typeof exitCode === 'number') return false;
      throw error;
    }
  }

  private async run(executable: 'initdb' | 'pg_ctl', args: string[]): Promise<void> {
    const file = postgresExecutable(this.options.binDir, executable);
    const { stdout, stderr } = await execFileAsync(file, args, {
      env: { ...process.env, LC_ALL: 'C', PGPASSWORD: '' },
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024, // 4 MB
    });
    for (const line of `${stdout}${stderr}`.split('\n').filter(Boolean)) this.options.log(`${executable}: ${line}`);
  }
}
