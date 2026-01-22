import { describe, it, expect } from 'vitest';
import { PactV4, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';

const { like, eachLike, integer, string, boolean } = MatchersV3;

const provider = new PactV4({
  consumer: 'MarketMindFrontend',
  provider: 'MarketMindBackendWallet',
  dir: path.resolve(process.cwd(), 'pacts'),
  logLevel: 'warn',
});

describe('Wallet API Contract', () => {
  describe('GET /trpc/wallet.list', () => {
    it('returns a list of wallets for authenticated user', async () => {
      await provider
        .addInteraction()
        .given('user is authenticated')
        .given('user has wallets')
        .uponReceiving('a request to list wallets')
        .withRequest('GET', '/trpc/wallet.list', (builder) => {
          builder.headers({
            'Content-Type': 'application/json',
            Cookie: like('session=valid-session-token'),
          });
        })
        .willRespondWith(200, (builder) => {
          builder.headers({ 'Content-Type': like('application/json') });
          builder.jsonBody({
            result: {
              data: eachLike({
                id: integer(1),
                name: string('Main Wallet'),
                exchange: string('binance'),
                type: string('futures'),
                isActive: boolean(true),
              }),
            },
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/trpc/wallet.list`, {
            headers: {
              'Content-Type': 'application/json',
              Cookie: 'session=valid-session-token',
            },
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.result.data).toBeDefined();
          expect(Array.isArray(data.result.data)).toBe(true);
        });
    });

    it('returns empty list when user has no wallets', async () => {
      await provider
        .addInteraction()
        .given('user is authenticated')
        .given('user has no wallets')
        .uponReceiving('a request to list wallets when none exist')
        .withRequest('GET', '/trpc/wallet.list', (builder) => {
          builder.headers({
            'Content-Type': 'application/json',
            Cookie: like('session=valid-session-token'),
          });
        })
        .willRespondWith(200, (builder) => {
          builder.headers({ 'Content-Type': like('application/json') });
          builder.jsonBody({
            result: {
              data: [],
            },
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/trpc/wallet.list`, {
            headers: {
              'Content-Type': 'application/json',
              Cookie: 'session=valid-session-token',
            },
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.result.data).toEqual([]);
        });
    });
  });

  describe('POST /trpc/wallet.createPaper', () => {
    it('creates a new paper wallet', async () => {
      await provider
        .addInteraction()
        .given('user is authenticated')
        .uponReceiving('a request to create a paper wallet')
        .withRequest('POST', '/trpc/wallet.createPaper', (builder) => {
          builder.headers({
            'Content-Type': 'application/json',
            Cookie: like('session=valid-session-token'),
          });
          builder.jsonBody({
            name: like('Test Paper Wallet'),
            initialBalance: like(10000),
          });
        })
        .willRespondWith(200, (builder) => {
          builder.headers({ 'Content-Type': like('application/json') });
          builder.jsonBody({
            result: {
              data: {
                id: integer(1),
                name: string('Test Paper Wallet'),
                exchange: string('paper'),
                type: string('paper'),
                isActive: boolean(true),
                initialBalance: integer(10000),
              },
            },
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/trpc/wallet.createPaper`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: 'session=valid-session-token',
            },
            body: JSON.stringify({
              name: 'Test Paper Wallet',
              initialBalance: 10000,
            }),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.result.data.name).toBe('Test Paper Wallet');
          expect(data.result.data.type).toBe('paper');
        });
    });
  });

  describe('Authentication errors', () => {
    it('returns 401 when not authenticated', async () => {
      await provider
        .addInteraction()
        .given('user is not authenticated')
        .uponReceiving('a request without authentication')
        .withRequest('GET', '/trpc/wallet.list')
        .willRespondWith(401, (builder) => {
          builder.headers({ 'Content-Type': like('application/json') });
          builder.jsonBody({
            error: {
              message: string('Unauthorized'),
              code: string('UNAUTHORIZED'),
            },
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/trpc/wallet.list`);

          expect(response.status).toBe(401);
          const data = await response.json();
          expect(data.error.code).toBe('UNAUTHORIZED');
        });
    });
  });
});
