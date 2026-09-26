import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { BackendProcess } from './BackendProcess';
import type { BootStatus } from './BootWindow';
import { EmbeddedPostgres } from './EmbeddedPostgres';
import { findFreePort, LOOPBACK_HOST } from './ports';
import { missingResources, type EmbeddedResources } from './resources';
import { loadOrCreateSecrets, type SecretCipher } from './secrets';

const DATABASE_NAME = 'marketmind';
const DATABASE_USER = 'marketmind';

export interface EmbeddedStack {
  backendUrl: string;
  dataDir: string;
  logsDir: string;
  stop(): Promise<void>;
}

export interface StartEmbeddedStackOptions {
  userDataDir: string;
  appVersion: string;
  resources: EmbeddedResources;
  cipher: SecretCipher;
  onStatus: (status: BootStatus) => void;
  log: (line: string) => void;
}

export interface EmbeddedDataLayout {
  dataDir: string;
  postgresDir: string;
  logsDir: string;
  userStrategiesDir: string;
  secretsFile: string;
}

export const embeddedDataLayout = (userDataDir: string): EmbeddedDataLayout => {
  const dataDir = path.join(userDataDir, 'data');
  return {
    dataDir,
    postgresDir: path.join(dataDir, 'postgres'),
    logsDir: path.join(dataDir, 'logs'),
    userStrategiesDir: path.join(dataDir, 'strategies', 'user'),
    secretsFile: path.join(userDataDir, 'secrets.json'),
  };
};

export interface BackendEnvironmentInput {
  resources: EmbeddedResources;
  layout: EmbeddedDataLayout;
  databaseUrl: string;
  port: number;
  appVersion: string;
  encryptionKey: string;
  sessionSecret: string;
}

export const backendEnvironment = ({ resources, layout, databaseUrl, port, appVersion, encryptionKey, sessionSecret }: BackendEnvironmentInput): Record<string, string> => {
  const origin = `http://${LOOPBACK_HOST}:${port}`;
  return {
    NODE_ENV: 'production',
    PORT: String(port),
    HOST: LOOPBACK_HOST,
    DATABASE_URL: databaseUrl,
    ENCRYPTION_KEY: encryptionKey,
    SESSION_SECRET: sessionSecret,
    CORS_ORIGIN: origin,
    APP_URL: origin,
    COOKIE_SECURE: 'false',
    MM_EMBEDDED: 'true',
    MM_RUN_MIGRATIONS: 'true',
    MM_DATA_DIR: layout.dataDir,
    MM_STRATEGIES_DIR: resources.builtinStrategiesDir,
    MM_USER_STRATEGIES_DIR: layout.userStrategiesDir,
    MM_MIGRATIONS_DIR: resources.migrationsDir,
    MM_RENDERER_DIR: resources.rendererDir,
    npm_package_version: appVersion,
    PATH: process.env['PATH'] ?? '',
    HOME: process.env['HOME'] ?? '',
    USERPROFILE: process.env['USERPROFILE'] ?? '',
    SYSTEMROOT: process.env['SYSTEMROOT'] ?? '',
    TMPDIR: process.env['TMPDIR'] ?? '',
    TEMP: process.env['TEMP'] ?? '',
  };
};

export const startEmbeddedStack = async ({ userDataDir, appVersion, resources, cipher, onStatus, log }: StartEmbeddedStackOptions): Promise<EmbeddedStack> => {
  const missing = missingResources(resources);
  if (missing.length > 0) throw new Error(`Embedded resources are missing: ${missing.join(', ')}`);

  const layout = embeddedDataLayout(userDataDir);
  for (const dir of [layout.dataDir, layout.logsDir, layout.userStrategiesDir]) mkdirSync(dir, { recursive: true });
  const secrets = loadOrCreateSecrets({ filePath: layout.secretsFile, cipher });

  onStatus('database');
  const postgres = new EmbeddedPostgres({
    binDir: resources.postgresBinDir,
    dataDir: layout.postgresDir,
    logFile: path.join(layout.logsDir, 'postgres.log'),
    port: await findFreePort(),
    user: DATABASE_USER,
    password: secrets.databasePassword,
    database: DATABASE_NAME,
    log,
  });
  await postgres.start();

  onStatus('backend');
  const backendPort = await findFreePort();
  const backend = new BackendProcess({
    entry: resources.backendEntry,
    port: backendPort,
    logFile: path.join(layout.logsDir, 'backend.log'),
    log,
    env: backendEnvironment({
      resources,
      layout,
      databaseUrl: postgres.connectionUrl,
      port: backendPort,
      appVersion,
      encryptionKey: secrets.encryptionKey,
      sessionSecret: secrets.sessionSecret,
    }),
  });
  try {
    await backend.start();
  } catch (error) {
    await postgres.stop().catch(() => undefined);
    throw error;
  }

  onStatus('ready');
  return {
    backendUrl: backend.url,
    dataDir: layout.dataDir,
    logsDir: layout.logsDir,
    stop: async () => {
      await backend.stop();
      await postgres.stop();
    },
  };
};
