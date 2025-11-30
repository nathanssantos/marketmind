import crypto from 'crypto';
import { env } from '../env';

const ENCRYPTION_KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex');
const IV_LENGTH = 16;

export const encryptApiKey = (plaintext: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
};

export const decryptApiKey = (encrypted: string): string => {
  const [ivHex, encryptedHex] = encrypted.split(':');
  if (!ivHex || !encryptedHex) throw new Error('Invalid encrypted data format');
  
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};
