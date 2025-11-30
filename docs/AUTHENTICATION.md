# 🔐 Authentication Implementation - MarketMind Backend

**Date:** November 30, 2025  
**Status:** Implemented  
**Approach:** Session-based authentication with Argon2 password hashing

---

## 📋 Overview

The backend uses a modern, secure authentication system built with industry-standard libraries and best practices.

### Technology Choices

- **Password Hashing:** Argon2 via `@node-rs/argon2` (Rust native bindings)
- **Session Management:** Custom implementation with PostgreSQL storage
- **Session IDs:** Cryptographically secure random tokens (base64url)
- **Cookie Handling:** `@fastify/cookie` 11.0.2

### Why Argon2?

Argon2 is the winner of the Password Hashing Competition (2015) and is recommended by OWASP for password storage:

- **More secure** than bcrypt and scrypt
- **Resistant** to GPU cracking attacks
- **Native performance** via Rust bindings (@node-rs/argon2)
- **Memory-hard** algorithm with configurable parameters

---

## 🏗️ Implementation

### 1. Password Hashing Configuration

```typescript
// apps/backend/src/services/auth.ts
import { hash, verify } from '@node-rs/argon2';

// Argon2 configuration (OWASP recommendations)
const ARGON2_CONFIG = {
  memoryCost: 19456,   // 19 MB (19456 KiB)
  timeCost: 2,         // 2 iterations
  outputLen: 32,       // 32 bytes output
  parallelism: 1,      // Single-threaded
};

export const createUser = async (email: string, password: string) => {
  const passwordHash = await hash(password, ARGON2_CONFIG);
  const userId = generateId(21);
  
  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
  });
  
  return userId;
};
```

### 2. Session Management

```typescript
// Session creation with 30-day expiration
export const createSession = async (userId: string) => {
  const sessionId = generateId(40);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  
  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  });
  
  return { sessionId, expiresAt };
};

// Session validation with automatic cleanup
export const validateSession = async (sessionId: string) => {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  
  if (!session) return null;
  
  // Check expiration and cleanup if expired
  if (Date.now() >= session.expiresAt.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }
  
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  
  if (!user) return null;
  
  return { session, user };
};
```

### 3. Secure ID Generation

```typescript
import { randomBytes } from 'crypto';

// Generate cryptographically secure IDs
const generateId = (length: number): string => {
  return randomBytes(length).toString('base64url').slice(0, length);
};

// User ID: 21 characters (126 bits entropy)
// Session ID: 40 characters (240 bits entropy)
```

### 4. tRPC Authentication Routers

```typescript
// apps/backend/src/routers/auth.ts
export const authRouter = router({
  register: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check if user exists
      const [existingUser] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      
      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Email already registered',
        });
      }
      
      const userId = await createUser(input.email, input.password);
      const { sessionId, expiresAt } = await createSession(userId);
      
      return { userId, sessionId, expiresAt };
    }),
    
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      
      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        });
      }
      
      const validPassword = await verify(user.passwordHash, input.password);
      
      if (!validPassword) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        });
      }
      
      const { sessionId, expiresAt } = await createSession(user.id);
      
      return { userId: user.id, sessionId, expiresAt };
    }),
    
  logout: publicProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.sessionId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        });
      }
      
      await invalidateSession(ctx.sessionId);
      
      return { success: true };
    }),
    
  me: publicProcedure
    .query(async ({ ctx }) => {
      if (!ctx.sessionId) return null;
      
      const result = await validateSession(ctx.sessionId);
      
      if (!result) return null;
      
      return {
        id: result.user.id,
        email: result.user.email,
      };
    }),
});
```

### 5. Protected Procedures

```typescript
// apps/backend/src/trpc/index.ts
import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure middleware
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  
  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // TypeScript knows user is non-null here
    },
  });
});
```

---

## 🔒 Security Features

### Password Requirements

- Minimum 8 characters (enforced by Zod)
- Hashed with Argon2 (memory-hard, GPU-resistant)
- Never stored in plaintext
- Different salt per password (automatic with Argon2)

### Session Security

- Cryptographically secure random IDs (240 bits entropy)
- 30-day expiration (configurable)
- Automatic cleanup on expiration
- Stored in PostgreSQL (ACID compliance)
- Session invalidation on logout

### Cookie Configuration

```typescript
// apps/backend/src/index.ts
await fastify.register(cookie, {
  secret: env.SESSION_SECRET, // 64+ byte secret
  parseOptions: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
});
```

### Rate Limiting

```typescript
await fastify.register(rateLimit, {
  max: 100,              // 100 requests
  timeWindow: '1 minute',
  cache: 10000,
  allowList: ['127.0.0.1'],
  keyGenerator: (req) => req.headers['x-forwarded-for'] as string || req.ip,
});
```

---

## 🧪 Testing Authentication

### 1. Register User

```bash
curl -X POST http://localhost:3001/trpc/auth.register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepass123"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3001/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepass123"
  }'
```

### 3. Get Current User

```bash
curl http://localhost:3001/trpc/auth.me \
  -H "Cookie: session_id=<sessionId>"
```

### 4. Logout

```bash
curl -X POST http://localhost:3001/trpc/auth.logout \
  -H "Cookie: session_id=<sessionId>"
```

---

## 📊 Database Schema

```sql
-- Users table
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Sessions table
CREATE TABLE sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

---

## 🚀 Migration Notes

### Why Not Lucia/Oslo?

Both Lucia and Oslo are deprecated (as of November 2025). The community has moved toward:

1. **Custom implementations** with proven libraries (Argon2, crypto)
2. **Framework-specific solutions** (Fastify plugins, Next.js Auth.js)
3. **Enterprise solutions** (Auth0, Clerk, Supabase Auth)

Our choice: **Custom implementation** because:
- Full control over security parameters
- No external dependencies on deprecated packages
- Lightweight and performant
- Easy to audit and maintain
- Uses industry-standard crypto primitives

### Argon2 vs bcrypt

| Feature | Argon2 | bcrypt |
|---------|--------|--------|
| Security | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| GPU Resistance | ✅ Excellent | ⚠️ Moderate |
| Memory-Hard | ✅ Yes | ❌ No |
| Performance | ⚡ Fast (native) | 🐌 Slower |
| Recommended by | OWASP, NIST | Legacy standard |

---

## 📚 References

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Argon2 Specification](https://github.com/P-H-C/phc-winner-argon2)
- [@node-rs/argon2 Documentation](https://github.com/napi-rs/node-rs/tree/main/packages/argon2)
- [tRPC Authentication Guide](https://trpc.io/docs/server/authorization)
- [Fastify Security Best Practices](https://fastify.dev/docs/latest/Guides/Security/)

---

**Last Updated:** November 30, 2025  
**Version:** 1.0
