import { hash } from '@node-rs/argon2';
import { getTestDatabase } from './test-db';
import * as schema from '../../db/schema';
import { generateEntityId, generateSessionId } from '../../utils/id';

type User = typeof schema.users.$inferSelect;
type Session = typeof schema.sessions.$inferSelect;
type Wallet = typeof schema.wallets.$inferSelect;
type TradingProfile = typeof schema.tradingProfiles.$inferSelect;

export interface CreateUserOptions {
  email?: string;
  password?: string;
}

export interface CreateWalletOptions {
  userId: string;
  name?: string;
  walletType?: 'live' | 'testnet' | 'paper';
  initialBalance?: string;
  currency?: string;
  apiKey?: string;
  apiSecret?: string;
}

export interface CreateTradingProfileOptions {
  userId: string;
  name?: string;
  enabledSetupTypes?: string[];
  maxPositionSize?: string | null;
  maxConcurrentPositions?: number | null;
  isDefault?: boolean;
}

export interface CreateSessionOptions {
  userId: string;
  expiresAt?: Date;
}

const hashPassword = async (password: string): Promise<string> => {
  return hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
};

export const createTestUser = async (options: CreateUserOptions = {}): Promise<{ user: User; password: string }> => {
  const db = getTestDatabase();
  const {
    email = `test-${Date.now()}@example.com`,
    password = 'Test123!@#',
  } = options;

  const userId = generateEntityId();
  const passwordHash = await hashPassword(password);

  const [user] = await db.insert(schema.users).values({
    id: userId,
    email,
    passwordHash,
  }).returning();

  if (!user) throw new Error('Failed to create test user');

  return { user, password };
};

export const createTestSession = async (options: CreateSessionOptions): Promise<Session> => {
  const db = getTestDatabase();
  const {
    userId,
    expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
  } = options;

  const sessionId = generateSessionId();

  const [session] = await db.insert(schema.sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  }).returning();

  if (!session) throw new Error('Failed to create test session');

  return session;
};

export const createTestWallet = async (options: CreateWalletOptions): Promise<Wallet> => {
  const db = getTestDatabase();
  const {
    userId,
    name = 'Test Wallet',
    walletType = 'paper',
    initialBalance = '10000',
    currency = 'USDT',
    apiKey = 'paper-trading',
    apiSecret = 'paper-trading',
  } = options;

  const walletId = generateEntityId();

  const [wallet] = await db.insert(schema.wallets).values({
    id: walletId,
    userId,
    name,
    walletType,
    apiKeyEncrypted: apiKey,
    apiSecretEncrypted: apiSecret,
    initialBalance,
    currentBalance: initialBalance,
    currency,
    isActive: true,
  }).returning();

  if (!wallet) throw new Error('Failed to create test wallet');

  return wallet;
};

export const createTestTradingProfile = async (options: CreateTradingProfileOptions): Promise<TradingProfile> => {
  const db = getTestDatabase();
  const {
    userId,
    name = 'Test Profile',
    enabledSetupTypes = ['larry-williams-9.1'],
    maxPositionSize = null,
    maxConcurrentPositions = null,
    isDefault = false,
  } = options;

  const profileId = generateEntityId();

  const [profile] = await db.insert(schema.tradingProfiles).values({
    id: profileId,
    userId,
    name,
    enabledSetupTypes: JSON.stringify(enabledSetupTypes),
    maxPositionSize,
    maxConcurrentPositions,
    isDefault,
  }).returning();

  if (!profile) throw new Error('Failed to create test trading profile');

  return profile;
};

export const createAuthenticatedUser = async (options: CreateUserOptions = {}): Promise<{ user: User; password: string; session: Session }> => {
  const { user, password } = await createTestUser(options);
  const session = await createTestSession({ userId: user.id });

  return { user, password, session };
};
