import { describe, it, expect } from 'vitest';
import { PactV4, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';

const { like, string, regex, integer } = MatchersV3;

const provider = new PactV4({
  consumer: 'MarketMindFrontend',
  provider: 'MarketMindBackendAuth',
  dir: path.resolve(process.cwd(), 'pacts'),
  logLevel: 'warn',
});

describe('Auth API Contract', () => {
  describe('POST /trpc/auth.login', () => {
    it('successfully logs in with valid credentials', async () => {
      await provider
        .addInteraction()
        .given('user exists with email test@example.com')
        .uponReceiving('a login request with valid credentials')
        .withRequest('POST', '/trpc/auth.login', (builder) => {
          builder.headers({ 'Content-Type': 'application/json' });
          builder.jsonBody({
            email: like('test@example.com'),
            password: like('ValidPassword123!'),
          });
        })
        .willRespondWith(200, (builder) => {
          builder.headers({
            'Content-Type': like('application/json'),
            'Set-Cookie': regex(
              'session=[a-zA-Z0-9-]+.*',
              'session=abc123-def456; Path=/; HttpOnly; SameSite=Strict'
            ),
          });
          builder.jsonBody({
            result: {
              data: {
                id: integer(1),
                email: string('test@example.com'),
              },
            },
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/trpc/auth.login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'test@example.com',
              password: 'ValidPassword123!',
            }),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.result.data.email).toBe('test@example.com');
          expect(response.headers.get('set-cookie')).toContain('session=');
        });
    });

    it('returns error for invalid credentials', async () => {
      await provider
        .addInteraction()
        .given('user exists with email test@example.com')
        .uponReceiving('a login request with invalid password')
        .withRequest('POST', '/trpc/auth.login', (builder) => {
          builder.headers({ 'Content-Type': 'application/json' });
          builder.jsonBody({
            email: like('test@example.com'),
            password: like('WrongPassword'),
          });
        })
        .willRespondWith(401, (builder) => {
          builder.headers({ 'Content-Type': like('application/json') });
          builder.jsonBody({
            error: {
              message: string('Invalid credentials'),
              code: string('UNAUTHORIZED'),
            },
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/trpc/auth.login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'test@example.com',
              password: 'WrongPassword',
            }),
          });

          expect(response.status).toBe(401);
          const data = await response.json();
          expect(data.error.code).toBe('UNAUTHORIZED');
        });
    });
  });

  describe('POST /trpc/auth.register', () => {
    it('successfully registers a new user', async () => {
      await provider
        .addInteraction()
        .given('email newuser@example.com is not registered')
        .uponReceiving('a registration request for new user')
        .withRequest('POST', '/trpc/auth.register', (builder) => {
          builder.headers({ 'Content-Type': 'application/json' });
          builder.jsonBody({
            email: like('newuser@example.com'),
            password: like('SecurePassword123!'),
          });
        })
        .willRespondWith(200, (builder) => {
          builder.headers({
            'Content-Type': like('application/json'),
            'Set-Cookie': regex(
              'session=[a-zA-Z0-9-]+.*',
              'session=abc123-def456; Path=/; HttpOnly; SameSite=Strict'
            ),
          });
          builder.jsonBody({
            result: {
              data: {
                id: integer(1),
                email: string('newuser@example.com'),
              },
            },
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/trpc/auth.register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'newuser@example.com',
              password: 'SecurePassword123!',
            }),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.result.data.email).toBe('newuser@example.com');
        });
    });

    it('returns error when email already exists', async () => {
      await provider
        .addInteraction()
        .given('user exists with email existing@example.com')
        .uponReceiving('a registration request with existing email')
        .withRequest('POST', '/trpc/auth.register', (builder) => {
          builder.headers({ 'Content-Type': 'application/json' });
          builder.jsonBody({
            email: like('existing@example.com'),
            password: like('SecurePassword123!'),
          });
        })
        .willRespondWith(409, (builder) => {
          builder.headers({ 'Content-Type': like('application/json') });
          builder.jsonBody({
            error: {
              message: string('Email already registered'),
              code: string('CONFLICT'),
            },
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/trpc/auth.register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'existing@example.com',
              password: 'SecurePassword123!',
            }),
          });

          expect(response.status).toBe(409);
          const data = await response.json();
          expect(data.error.code).toBe('CONFLICT');
        });
    });
  });

  describe('GET /trpc/auth.me', () => {
    it('returns current user when authenticated', async () => {
      await provider
        .addInteraction()
        .given('user is authenticated')
        .uponReceiving('a request to get current user')
        .withRequest('GET', '/trpc/auth.me', (builder) => {
          builder.headers({
            Cookie: like('session=valid-session-token'),
          });
        })
        .willRespondWith(200, (builder) => {
          builder.headers({ 'Content-Type': like('application/json') });
          builder.jsonBody({
            result: {
              data: {
                id: integer(1),
                email: string('test@example.com'),
              },
            },
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/trpc/auth.me`, {
            headers: {
              Cookie: 'session=valid-session-token',
            },
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.result.data.email).toBeDefined();
        });
    });
  });

  describe('POST /trpc/auth.logout', () => {
    it('successfully logs out', async () => {
      await provider
        .addInteraction()
        .given('user is authenticated')
        .uponReceiving('a logout request')
        .withRequest('POST', '/trpc/auth.logout', (builder) => {
          builder.headers({
            'Content-Type': 'application/json',
            Cookie: like('session=valid-session-token'),
          });
        })
        .willRespondWith(200, (builder) => {
          builder.headers({
            'Content-Type': like('application/json'),
          });
          builder.jsonBody({
            result: {
              data: {
                success: true,
              },
            },
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/trpc/auth.logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: 'session=valid-session-token',
            },
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.result.data.success).toBe(true);
        });
    });
  });
});
