import { describe, expect, it } from 'vitest';
import { connectionString, initdbArgs, pgCtlStartArgs, pgCtlStopArgs, serverFlags } from '../postgresArgs';

describe('postgres arguments', () => {
  it('initializes a UTF-8 cluster with scram authentication and the given superuser', () => {
    const args = initdbArgs({ dataDir: '/data/postgres', user: 'marketmind', passwordFile: '/data/pw.tmp' });
    expect(args).toEqual(['--pgdata', '/data/postgres', '--username', 'marketmind', '--pwfile', '/data/pw.tmp', '--encoding', 'UTF8', '--locale', 'C', '--auth', 'scram-sha-256']);
  });

  it('starts the server on the loopback interface only, on the chosen port, without a unix socket', () => {
    expect(serverFlags(54329)).toBe("-p 54329 -c listen_addresses=127.0.0.1 -c unix_socket_directories='' -c max_connections=50");
    const args = pgCtlStartArgs({ dataDir: '/data/postgres', logFile: '/data/logs/postgres.log', port: 54329 });
    expect(args.slice(0, 5)).toEqual(['start', '--pgdata', '/data/postgres', '--log', '/data/logs/postgres.log']);
    expect(args).toContain('--wait');
    expect(args[args.length - 1]).toBe(serverFlags(54329));
  });

  it('stops fast and waits', () => {
    expect(pgCtlStopArgs('/data/postgres')).toEqual(['stop', '--pgdata', '/data/postgres', '--mode', 'fast', '--wait', '--timeout', '30']);
  });

  it('url-encodes the password in the connection string', () => {
    expect(connectionString({ user: 'marketmind', password: 'a/b+c=', port: 54329, database: 'marketmind' })).toBe(
      'postgresql://marketmind:a%2Fb%2Bc%3D@127.0.0.1:54329/marketmind',
    );
  });
});
