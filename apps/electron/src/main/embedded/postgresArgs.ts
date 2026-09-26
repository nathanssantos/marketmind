import path from 'node:path';

export interface PostgresLocation {
  binDir: string;
  dataDir: string;
  logFile: string;
}

export interface PostgresServerOptions extends PostgresLocation {
  port: number;
  user: string;
  passwordFile: string;
}

const executableSuffix = process.platform === 'win32' ? '.exe' : '';

export const postgresExecutable = (binDir: string, name: 'initdb' | 'pg_ctl' | 'postgres'): string =>
  path.join(binDir, `${name}${executableSuffix}`);

export const initdbArgs = ({ dataDir, user, passwordFile }: Pick<PostgresServerOptions, 'dataDir' | 'user' | 'passwordFile'>): string[] => [
  '--pgdata', dataDir,
  '--username', user,
  '--pwfile', passwordFile,
  '--encoding', 'UTF8',
  '--locale', 'C',
  '--auth', 'scram-sha-256',
];

export const serverFlags = (port: number): string =>
  [`-p ${port}`, `-c listen_addresses=127.0.0.1`, `-c unix_socket_directories=''`, `-c max_connections=50`].join(' ');

export const pgCtlStartArgs = ({ dataDir, logFile, port }: Pick<PostgresServerOptions, 'dataDir' | 'logFile' | 'port'>): string[] => [
  'start',
  '--pgdata', dataDir,
  '--log', logFile,
  '--wait',
  '--timeout', '90',
  '--options', serverFlags(port),
];

export const pgCtlStopArgs = (dataDir: string): string[] => ['stop', '--pgdata', dataDir, '--mode', 'fast', '--wait', '--timeout', '30'];

export const pgCtlStatusArgs = (dataDir: string): string[] => ['status', '--pgdata', dataDir];

export const connectionString = ({ user, password, port, database }: { user: string; password: string; port: number; database: string }): string =>
  `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}`;
