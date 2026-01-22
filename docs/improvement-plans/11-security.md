# Plano de Melhoria: Segurança

## 1. Estado Atual

### 1.1 Medidas de Segurança Implementadas

| Área | Implementação | Status |
|------|---------------|--------|
| Password Hashing | Argon2 (OWASP compliant) | ✅ |
| API Key Encryption | AES-256-CBC | ✅ |
| Session Management | Secure cookies + DB sessions | ✅ |
| HTTPS | Electron local + HTTPS em produção | ✅ |
| Input Validation | Zod schemas | ✅ |
| SQL Injection | Drizzle ORM (prepared statements) | ✅ |

### 1.2 Arquitetura de Autenticação

```
apps/backend/src/services/
├── auth/
│   ├── password.ts          # Argon2 hashing
│   └── session.ts           # Session management
└── encryption/
    └── api-keys.ts          # AES-256-CBC encryption
```

### 1.3 Configuração de Segurança

```typescript
// Password hashing (OWASP compliant)
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

// Session config
const SESSION_CONFIG = {
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
};
```

---

## 2. Análise Acadêmica

### 2.1 OWASP Top 10 (2021)

**Referência:** https://owasp.org/Top10/

| # | Vulnerabilidade | MarketMind Status |
|---|-----------------|-------------------|
| A01 | Broken Access Control | ✅ Protegido (tRPC procedures) |
| A02 | Cryptographic Failures | ✅ AES-256 + Argon2 |
| A03 | Injection | ✅ Drizzle ORM + Zod |
| A04 | Insecure Design | 🟡 Necessita revisão |
| A05 | Security Misconfiguration | 🟡 Necessita hardening |
| A06 | Vulnerable Components | 🟡 Dependências |
| A07 | Auth Failures | ✅ Session + Argon2 |
| A08 | Software/Data Integrity | ⏳ Pendente |
| A09 | Logging/Monitoring | ⏳ Pendente |
| A10 | SSRF | ✅ N/A (sem fetch externo) |

### 2.2 Password Security

**Referências:**
- "Password Storage Cheat Sheet" (OWASP)
- "Argon2: the memory-hard function for password hashing" (Biryukov et al., 2016)

**Argon2 Justificativa:**
- Vencedor do Password Hashing Competition (2015)
- Resistente a GPU attacks
- Memory-hard (proteção contra ASICs)
- Recomendado por OWASP

**Configuração Recomendada (OWASP):**
```
Argon2id:
- Memória: 19 MiB (19456 KiB)
- Iterações: 2
- Paralelismo: 1
- Output: 32 bytes
```

### 2.3 API Key Encryption

**Referências:**
- "Practical Cryptography for Developers" (Svetlin Nakov)
- NIST SP 800-38A (AES modes)

**AES-256-CBC:**
- 256-bit key (suficiente para dados sensíveis)
- CBC mode com IV único por criptografia
- PKCS7 padding

**Alternativa Considerada:**
```
AES-256-GCM (authenticated encryption)
- Adiciona integridade além de confidencialidade
- Recomendado para novas implementações
```

### 2.4 Session Security

**Referências:**
- "Session Management Cheat Sheet" (OWASP)
- RFC 6265 (HTTP State Management)

**Best Practices:**
1. **HttpOnly** - Impede acesso JavaScript
2. **Secure** - Apenas HTTPS
3. **SameSite** - Proteção CSRF
4. **Token rotation** - Após login/privilege change
5. **Expiration** - Tempo limite razoável

### 2.5 Rate Limiting

**Referências:**
- "Rate Limiting Strategies" (AWS Well-Architected)
- "API Rate Limiting" (Kong)

**Algoritmos:**
1. **Token Bucket** - Bursty traffic friendly
2. **Leaky Bucket** - Constant rate
3. **Fixed Window** - Simples, mas race conditions
4. **Sliding Window** - Mais preciso

---

## 3. Benchmarking de Mercado

### 3.1 Binance Security

- 2FA obrigatório para withdrawals
- IP whitelisting
- API key permissions granulares
- Anti-phishing code
- Cold storage (95% dos ativos)

### 3.2 Coinbase Security

- SOC 2 Type II compliance
- Bug bounty program
- Insurance coverage
- Biometric auth
- Vault time-locks

### 3.3 Bloomberg Terminal

- Hardware tokens
- Biometric auth
- Network isolation
- Audit logging completo
- Compliance reporting

---

## 4. Problemas Identificados

### 4.1 Logging de Segurança Ausente

**Problema:** Não há logs de eventos de segurança.

**Eventos que devem ser logados:**
- Login attempts (success/failure)
- Password changes
- API key creation/rotation
- Permission changes
- Suspicious activity

### 4.2 Rate Limiting Ausente

**Problema:** Sem proteção contra brute force.

**Endpoints vulneráveis:**
- `/auth/login`
- `/auth/register`
- `/wallet/create` (API key validation)

### 4.3 Falta de 2FA

**Problema:** Apenas senha para autenticação.

**Impacto:**
- Compromisso de senha = acesso total
- Sem camada adicional de proteção
- Fora do padrão de mercado

### 4.4 Dependency Vulnerabilities

**Problema:** Dependências podem ter CVEs.

**Ação necessária:**
```bash
pnpm audit
# Verificar e atualizar dependências vulneráveis
```

### 4.5 Secrets Management

**Problema:** ENCRYPTION_KEY em .env.

**Riscos:**
- Pode ser commitado acidentalmente
- Não é rotacionado
- Sem backup seguro

---

## 5. Melhorias Propostas

### 5.1 Security Logging

```typescript
// services/security/audit-logger.ts
import pino from 'pino';

export const auditLogger = pino({
  name: 'security-audit',
  level: 'info',
});

export enum SecurityEvent {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_ROTATED = 'API_KEY_ROTATED',
  SESSION_INVALIDATED = 'SESSION_INVALIDATED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}

export const logSecurityEvent = (
  event: SecurityEvent,
  userId: string | null,
  metadata: Record<string, unknown>
) => {
  auditLogger.info({
    event,
    userId,
    timestamp: new Date().toISOString(),
    ip: metadata.ip,
    userAgent: metadata.userAgent,
    ...metadata,
  });
};

// Uso em auth.ts:
logSecurityEvent(SecurityEvent.LOGIN_SUCCESS, user.id, {
  ip: ctx.req.ip,
  userAgent: ctx.req.headers['user-agent'],
});
```

### 5.2 Rate Limiting

```typescript
// middleware/rate-limit.ts
import { RateLimiterMemory } from 'rate-limiter-flexible';

const loginLimiter = new RateLimiterMemory({
  points: 5, // 5 attempts
  duration: 60 * 15, // per 15 minutes
  blockDuration: 60 * 60, // block for 1 hour
});

const apiLimiter = new RateLimiterMemory({
  points: 100,
  duration: 60, // per minute
});

export const rateLimitMiddleware = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  const key = req.ip;

  try {
    await apiLimiter.consume(key);
  } catch {
    res.status(429).send({ error: 'Too many requests' });
  }
};

// Para login:
export const loginRateLimitMiddleware = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  const key = `${req.ip}_${req.body.email}`;

  try {
    await loginLimiter.consume(key);
  } catch {
    logSecurityEvent(SecurityEvent.SUSPICIOUS_ACTIVITY, null, {
      ip: req.ip,
      reason: 'rate_limit_exceeded',
      email: req.body.email,
    });
    res.status(429).send({
      error: 'Too many login attempts. Try again later.',
    });
  }
};
```

### 5.3 Two-Factor Authentication (2FA)

```typescript
// services/auth/two-factor.ts
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export const generateTOTPSecret = (email: string) => {
  const secret = speakeasy.generateSecret({
    name: `MarketMind:${email}`,
    issuer: 'MarketMind',
  });

  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url!,
  };
};

export const generateQRCode = async (otpauthUrl: string): Promise<string> => {
  return QRCode.toDataURL(otpauthUrl);
};

export const verifyTOTP = (secret: string, token: string): boolean => {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1, // Allow 1 step tolerance
  });
};

// Schema update:
// users table: add totp_secret, totp_enabled columns

// Auth flow update:
// 1. Login with email/password
// 2. If TOTP enabled, return { requiresTOTP: true }
// 3. Client sends TOTP code
// 4. Verify and create session
```

### 5.4 Dependency Scanning

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  push:
    branches: [main, develop]
  schedule:
    - cron: '0 0 * * *' # Daily

jobs:
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run pnpm audit
        run: pnpm audit --audit-level=high

      - name: Run Snyk
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  code-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run CodeQL
        uses: github/codeql-action/analyze@v2
        with:
          languages: typescript
```

### 5.5 Secrets Management

```typescript
// Para produção: usar serviço de secrets
// Opções: AWS Secrets Manager, HashiCorp Vault, 1Password

// services/secrets/manager.ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

export const getSecret = async (secretId: string): Promise<string> => {
  const command = new GetSecretValueCommand({ SecretId: secretId });
  const response = await client.send(command);

  if (response.SecretString) {
    return response.SecretString;
  }

  throw new Error('Secret not found');
};

// Rotação de chaves
export const rotateEncryptionKey = async (): Promise<void> => {
  // 1. Gerar nova chave
  // 2. Re-encriptar todos os dados com nova chave
  // 3. Atualizar secret
  // 4. Invalidar chave antiga
};
```

### 5.6 Security Headers

```typescript
// plugins/security-headers.ts
import helmet from '@fastify/helmet';

app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'wss://stream.binance.com'],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true },
});
```

### 5.7 API Key Permissions

```typescript
// services/wallet/permissions.ts
export enum APIPermission {
  SPOT_READ = 'SPOT_READ',
  SPOT_TRADE = 'SPOT_TRADE',
  FUTURES_READ = 'FUTURES_READ',
  FUTURES_TRADE = 'FUTURES_TRADE',
  WITHDRAW = 'WITHDRAW', // Never enable
}

interface WalletPermissions {
  walletId: string;
  permissions: APIPermission[];
  ipWhitelist: string[];
}

export const validatePermissions = (
  wallet: Wallet,
  requiredPermission: APIPermission
): boolean => {
  // Check if API key has required permission
  // This requires Binance API call to verify
  return wallet.permissions.includes(requiredPermission);
};

// UI: Show warning if WITHDRAW permission detected
// Backend: Block operations if WITHDRAW detected
```

---

## 6. Plano de Implementação

### Fase 1: Quick Wins (3 dias)

| Task | Prioridade |
|------|------------|
| Implementar security logging | P1 |
| Adicionar rate limiting | P1 |
| Configurar security headers | P1 |
| Rodar pnpm audit e corrigir | P1 |

### Fase 2: 2FA (1 semana)

| Task | Prioridade |
|------|------------|
| Implementar TOTP generation | P1 |
| UI para setup de 2FA | P1 |
| Auth flow com 2FA | P1 |
| Recovery codes | P2 |

### Fase 3: Advanced Security (2 semanas)

| Task | Prioridade |
|------|------------|
| API key permissions validation | P2 |
| IP whitelisting | P2 |
| Secrets management (prod) | P2 |
| Key rotation procedure | P2 |

### Fase 4: Compliance (1 semana)

| Task | Prioridade |
|------|------------|
| Security policy documentation | P3 |
| Incident response plan | P3 |
| Bug bounty program (future) | P3 |
| Security audit checklist | P2 |

---

## 7. Critérios de Validação

### 7.1 OWASP Compliance

- [ ] A01: Access control em todas procedures
- [ ] A02: AES-256-GCM para novas encriptações
- [ ] A03: Zero SQL injection vectors
- [ ] A05: Security headers configurados
- [ ] A06: Zero CVEs em dependências
- [ ] A07: 2FA disponível
- [ ] A09: Audit logging completo

### 7.2 Authentication

- [ ] Rate limiting em endpoints sensíveis
- [ ] 2FA funcional
- [ ] Session rotation após privilege change
- [ ] Password requirements enforced

### 7.3 Encryption

- [ ] API keys encriptados (AES-256)
- [ ] Secrets em serviço dedicado (prod)
- [ ] Key rotation procedure documentada
- [ ] Backups encriptados

### 7.4 Monitoring

- [ ] Security events logados
- [ ] Alertas para suspicious activity
- [ ] Failed login monitoring
- [ ] API abuse detection

---

## 8. Arquivos a Criar/Modificar

### Criar

1. `services/security/audit-logger.ts`
2. `middleware/rate-limit.ts`
3. `services/auth/two-factor.ts`
4. `services/secrets/manager.ts`
5. `plugins/security-headers.ts`
6. `.github/workflows/security.yml`
7. `docs/SECURITY.md`

### Modificar

1. `routers/auth.ts` - Add 2FA, rate limiting
2. `db/schema.ts` - Add totp columns
3. `services/encryption/api-keys.ts` - Consider GCM
4. `.env.example` - Security config documentation

### Documentar

1. Security policy
2. Incident response
3. Key rotation procedure
4. Vulnerability disclosure
