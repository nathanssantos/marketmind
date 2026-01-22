# Security Policy

## Overview

MarketMind implements multiple layers of security to protect user data and prevent unauthorized access. This document outlines our security measures, policies, and guidelines.

## Implemented Security Measures

### Authentication

| Feature | Implementation | Status |
|---------|----------------|--------|
| Password Hashing | Argon2id (OWASP compliant) | ✅ |
| Session Management | Secure HTTP-only cookies | ✅ |
| Rate Limiting | Per-IP and per-email tracking | ✅ |
| Security Logging | Audit events with pino | ✅ |

### Cryptography

| Feature | Implementation | Status |
|---------|----------------|--------|
| API Key Encryption | AES-256-CBC | ✅ |
| Password Storage | Argon2id | ✅ |
| Session Tokens | Cryptographically secure random | ✅ |

### Network Security

| Feature | Implementation | Status |
|---------|----------------|--------|
| HTTPS | Required in production | ✅ |
| CORS | Origin validation | ✅ |
| Security Headers | @fastify/helmet | ✅ |
| Rate Limiting | @fastify/rate-limit | ✅ |

## Password Security

We use Argon2id for password hashing with OWASP-recommended parameters:

```typescript
{
  memoryCost: 19456,  // 19 MiB
  timeCost: 2,        // 2 iterations
  outputLen: 32,      // 32 bytes
  parallelism: 1      // 1 thread
}
```

Argon2id was selected because:
- Winner of the Password Hashing Competition (2015)
- Resistant to GPU and ASIC attacks
- Memory-hard function
- Recommended by OWASP

## Rate Limiting

### Global Rate Limiting

- **Default**: 1000 requests per minute per IP
- **Configurable** via environment variables:
  - `RATE_LIMIT_MAX`: Maximum requests
  - `RATE_LIMIT_WINDOW`: Time window in milliseconds

### Authentication Rate Limiting

| Endpoint | Max Attempts | Window | Block Duration |
|----------|--------------|--------|----------------|
| Login | 5 | 15 minutes | 1 hour |
| Register | 3 | 1 hour | 24 hours |

After exceeding the limit, requests are blocked and a `429 Too Many Requests` response is returned.

## Security Event Logging

All security-relevant events are logged with the following information:
- Event type
- User ID (if available)
- IP address
- User agent
- Timestamp
- Additional context

### Logged Events

| Event | Description | Log Level |
|-------|-------------|-----------|
| LOGIN_SUCCESS | Successful login | INFO |
| LOGIN_FAILURE | Failed login attempt | WARN |
| LOGOUT | User logout | INFO |
| REGISTER_SUCCESS | New user registration | INFO |
| REGISTER_FAILURE | Failed registration | WARN |
| RATE_LIMIT_EXCEEDED | Rate limit hit | WARN |
| SUSPICIOUS_ACTIVITY | Unusual behavior detected | WARN |
| API_KEY_CREATED | New API key added | INFO |
| API_KEY_DELETED | API key removed | INFO |
| WALLET_CREATED | New wallet created | INFO |
| WALLET_DELETED | Wallet removed | INFO |

## Session Security

- **Duration**: 30 days
- **Storage**: Server-side in database
- **Cookie Flags**:
  - `HttpOnly`: Prevents JavaScript access
  - `Secure`: HTTPS only in production
  - `SameSite=Lax`: CSRF protection
  - `Path=/`: Scoped to root

## API Key Security

Exchange API keys are encrypted at rest using AES-256-CBC:
- Unique IV for each encryption
- Keys never logged or exposed in responses
- Decrypted only when needed for trading operations

## Security Headers

The following security headers are set via @fastify/helmet:

| Header | Value |
|--------|-------|
| Content-Security-Policy | `default-src 'self'` |
| X-Frame-Options | `DENY` |
| X-Content-Type-Options | `nosniff` |
| X-XSS-Protection | `1; mode=block` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` (production) |

## Vulnerability Reporting

If you discover a security vulnerability, please report it responsibly:

1. **Do not** create a public GitHub issue
2. Email security concerns to the maintainers
3. Include detailed steps to reproduce
4. Allow reasonable time for a fix before disclosure

## Dependency Security

- Dependencies are audited with `pnpm audit`
- GitHub Dependabot alerts are enabled
- CodeQL security analysis runs on all PRs
- Secret scanning is enabled on the repository

## Development Guidelines

### Do

- Use parameterized queries (Drizzle ORM)
- Validate all input with Zod schemas
- Use the security logging utilities
- Keep dependencies updated
- Follow the principle of least privilege

### Don't

- Log sensitive data (passwords, API keys)
- Store secrets in code or version control
- Disable security headers
- Bypass rate limiting
- Trust client-side validation alone

## Compliance

MarketMind aims to comply with:
- OWASP Top 10 (2021)
- OWASP Authentication Cheat Sheet
- OWASP Session Management Cheat Sheet
- OWASP Password Storage Cheat Sheet

## Security Roadmap

### Planned Features

- [ ] Two-Factor Authentication (TOTP)
- [ ] Account recovery codes
- [ ] IP whitelisting for API keys
- [ ] Session management UI
- [ ] Security audit log viewer
- [ ] Secrets management service integration

## Contact

For security-related inquiries, contact the project maintainers directly.
