import { randomBytes } from 'crypto';

export const generateId = (length = 21): string =>
  randomBytes(Math.ceil(length * 0.75))
    .toString('base64url')
    .slice(0, length);

export const generateSessionId = (): string => generateId(40);

export const generateEntityId = (): string => generateId(21);

export const generateShortId = (): string => generateId(16);
