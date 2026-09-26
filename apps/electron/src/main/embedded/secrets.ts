import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface EmbeddedSecrets {
  encryptionKey: string;
  sessionSecret: string;
  databasePassword: string;
}

export interface SecretCipher {
  isAvailable(): boolean;
  encrypt(plain: string): Buffer;
  decrypt(cipher: Buffer): string;
}

interface SecretsFile {
  version: 1;
  encrypted: boolean;
  payload: string;
}

const ENCRYPTION_KEY_BYTES = 32;
const SESSION_SECRET_BYTES = 32;
const DATABASE_PASSWORD_BYTES = 24;
const OWNER_READ_WRITE = 0o600;

export const generateSecrets = (): EmbeddedSecrets => ({
  encryptionKey: randomBytes(ENCRYPTION_KEY_BYTES).toString('hex'),
  sessionSecret: randomBytes(SESSION_SECRET_BYTES).toString('base64url'),
  databasePassword: randomBytes(DATABASE_PASSWORD_BYTES).toString('base64url'),
});

const serialize = (secrets: EmbeddedSecrets, cipher: SecretCipher): SecretsFile => {
  const plain = JSON.stringify(secrets);
  if (cipher.isAvailable()) return { version: 1, encrypted: true, payload: cipher.encrypt(plain).toString('base64') };
  return { version: 1, encrypted: false, payload: Buffer.from(plain, 'utf8').toString('base64') };
};

const deserialize = (file: SecretsFile, cipher: SecretCipher): EmbeddedSecrets => {
  const buffer = Buffer.from(file.payload, 'base64');
  const plain = file.encrypted ? cipher.decrypt(buffer) : buffer.toString('utf8');
  return JSON.parse(plain) as EmbeddedSecrets;
};

export interface LoadSecretsOptions {
  filePath: string;
  cipher: SecretCipher;
}

export const loadOrCreateSecrets = ({ filePath, cipher }: LoadSecretsOptions): EmbeddedSecrets => {
  if (existsSync(filePath)) {
    const file = JSON.parse(readFileSync(filePath, 'utf8')) as SecretsFile;
    return deserialize(file, cipher);
  }
  const secrets = generateSecrets();
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(serialize(secrets, cipher)), { mode: OWNER_READ_WRITE });
  return secrets;
};
