import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupTestDatabase, teardownTestDatabase } from '../helpers/test-db';
import { createUnauthenticatedCaller } from '../helpers/test-caller';

describe('Health Router', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('check', () => {
    it('should return ok status', async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.health.check();

      expect(result.status).toBe('ok');
    });

    it('should return a valid timestamp', async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.health.check();

      expect(result.timestamp).toBeDefined();
      const timestamp = new Date(result.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('should return a version string', async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.health.check();

      expect(result.version).toBeDefined();
      expect(typeof result.version).toBe('string');
    });

    it('should not require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.health.check();

      expect(result.status).toBe('ok');
    });
  });

  describe('ping', () => {
    it('should return pong true', async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.health.ping({});

      expect(result.pong).toBe(true);
    });

    it('should echo the message', async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.health.ping({ message: 'Hello, World!' });

      expect(result.pong).toBe(true);
      expect(result.echo).toBe('Hello, World!');
    });

    it('should return default message when no message provided', async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.health.ping({});

      expect(result.echo).toBe('No message provided');
    });

    it('should not require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.health.ping({ message: 'test' });

      expect(result.pong).toBe(true);
    });
  });
});
