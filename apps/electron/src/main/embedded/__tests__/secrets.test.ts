import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateSecrets, loadOrCreateSecrets, type SecretCipher } from '../secrets';

const reversingCipher = (available: boolean): SecretCipher => ({
  isAvailable: () => available,
  encrypt: (plain) => Buffer.from([...plain].reverse().join(''), 'utf8'),
  decrypt: (cipher) => [...cipher.toString('utf8')].reverse().join(''),
});

describe('embedded secrets', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'mm-secrets-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('generates a 64-hex encryption key, a session secret and a database password', () => {
    const secrets = generateSecrets();
    expect(secrets.encryptionKey).toMatch(/^[0-9a-f]{64}$/);
    expect(secrets.sessionSecret.length).toBeGreaterThanOrEqual(32);
    expect(secrets.databasePassword.length).toBeGreaterThanOrEqual(24);
  });

  it('creates the file once and returns the same secrets on the next load', () => {
    const filePath = path.join(dir, 'nested', 'secrets.json');
    const first = loadOrCreateSecrets({ filePath, cipher: reversingCipher(true) });
    const second = loadOrCreateSecrets({ filePath, cipher: reversingCipher(true) });
    expect(second).toEqual(first);
  });

  it('stores the payload encrypted when the cipher is available', () => {
    const filePath = path.join(dir, 'secrets.json');
    const secrets = loadOrCreateSecrets({ filePath, cipher: reversingCipher(true) });
    const raw = readFileSync(filePath, 'utf8');
    expect(JSON.parse(raw).encrypted).toBe(true);
    expect(raw).not.toContain(secrets.encryptionKey);
  });

  it('falls back to a plain payload when the cipher is unavailable', () => {
    const filePath = path.join(dir, 'secrets.json');
    const secrets = loadOrCreateSecrets({ filePath, cipher: reversingCipher(false) });
    const file = JSON.parse(readFileSync(filePath, 'utf8')) as { encrypted: boolean; payload: string };
    expect(file.encrypted).toBe(false);
    expect(JSON.parse(Buffer.from(file.payload, 'base64').toString('utf8'))).toEqual(secrets);
  });

  it('writes the file readable by the owner only', () => {
    if (process.platform === 'win32') return;
    const filePath = path.join(dir, 'secrets.json');
    loadOrCreateSecrets({ filePath, cipher: reversingCipher(true) });
    expect(statSync(filePath).mode & 0o777).toBe(0o600);
  });
});
