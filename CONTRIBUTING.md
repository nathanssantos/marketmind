# Contributing to MarketMind

Thank you for your interest in contributing to MarketMind! This document provides guidelines for contributing to the project.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/marketmind.git
   cd marketmind
   ```
3. **Install dependencies**:
   ```bash
   pnpm install
   ```
4. **Setup backend** (see [Backend Setup](#backend-setup))
5. **Create a feature branch**:
   ```bash
   git checkout develop
   git checkout -b feature/your-feature-name
   ```

## 📋 Development Workflow

### Branch Strategy

- `main` - Production releases (protected)
- `develop` - Development branch (default, protected)
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Critical production fixes

**NEVER commit directly to `main` or `develop`!**

### Making Changes

1. **Write code** following project guidelines (see `.github/copilot-instructions.md`)
2. **Write tests** for new functionality
3. **Run tests** frequently during development:
   ```bash
   pnpm test
   ```
4. **Check types** and linting:
   ```bash
   pnpm type-check
   pnpm lint
   ```

### Commit Guidelines

Use [Conventional Commits](https://www.conventionalcommits.org/) format (English only):

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks
- `style:` - Code style changes (formatting, etc.)
- `ci:` - CI/CD changes

**Examples:**
```bash
git commit -m "feat: add real-time price notifications"
git commit -m "fix: resolve WebSocket reconnection issue"
git commit -m "docs: update API documentation"
git commit -m "refactor: simplify kline processing logic"
```

### Pre-Commit Checklist

Before committing, ensure:

- [ ] **All tests pass** - `pnpm test` (MANDATORY)
- [ ] **No TypeScript errors** - `pnpm type-check`
- [ ] **No linting errors** - `pnpm lint`
- [ ] **No code comments** (use README files instead)
- [ ] **No magic numbers** (extracted to constants)
- [ ] **No `any` types** (use proper types)
- [ ] **CHANGELOG.md updated** (if applicable)
- [ ] **Tests cover new code**
- [ ] **User-facing text internationalized** (no hardcoded strings)

**🔴 CRITICAL: Never commit with failing tests!**

### Submitting Changes

1. **Push your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request** to `develop` branch:
   - Use descriptive title
   - Reference related issues
   - Describe what changed and why
   - Include screenshots for UI changes
   - Ensure all CI checks pass

3. **Address review feedback** if any

4. **Merge** once approved (squash and merge preferred)

## 🧪 Testing

### Running Tests

```bash
# All tests
pnpm test

# Frontend only
pnpm --filter @marketmind/electron test

# Backend only
pnpm --filter @marketmind/backend test

# With coverage
pnpm test:coverage

# Watch mode (NOT for commits)
pnpm test:watch
```

### Writing Tests

- **Location**: Place tests next to the code being tested
- **Naming**: `*.test.ts` or `*.test.tsx`
- **Coverage**: Aim for >80% coverage
- **Types**: Unit tests, integration tests, E2E tests

**Example:**
```typescript
import { describe, it, expect } from 'vitest';
import { calculateSMA } from './utils';

describe('calculateSMA', () => {
  it('should calculate simple moving average correctly', () => {
    const data = [10, 20, 30, 40, 50];
    const result = calculateSMA(data, 3);
    expect(result).toBe(40);
  });
  
  it('should return 0 for empty array', () => {
    const result = calculateSMA([], 3);
    expect(result).toBe(0);
  });
});
```

## 📝 Code Style

### TypeScript

- **No `any` types** - Use proper types, `unknown`, or generics
- **No magic numbers** - Extract to constants
- **Early returns** - Prefer over nested ifs
- **Single-line blocks** - When appropriate: `if (x) return y;`
- **One-line conditionals** - Use ternary for simple cases
- **Self-documenting code** - No inline comments

**Good:**
```typescript
const RETRY_DELAY = 5000;

const fetchData = async (id: string): Promise<Data | null> => {
  if (!id) return null;
  
  try {
    return await api.get(`/data/${id}`);
  } catch (error) {
    console.error('Failed to fetch:', error);
    return null;
  }
};
```

**Bad:**
```typescript
const fetchData = async (id: any) => {
  // Check if ID exists
  if (id) {
    try {
      const result = await api.get(`/data/${id}`);
      return result;
    } catch (error) {
      // Log error
      console.error(error);
      return null;
    }
  } else {
    return null;
  }
};
```

### File Naming

- **Components**: PascalCase - `ChartCanvas.tsx`
- **Utilities**: camelCase - `drawingUtils.ts`
- **Types**: camelCase - `kline.ts`
- **Constants**: camelCase - `chartConfig.ts`

### Import Order

```typescript
// 1. External dependencies
import React, { useState } from 'react';
import { Box } from '@chakra-ui/react';

// 2. Internal absolute imports
import type { Kline } from '@shared/types';
import { CHART_CONFIG } from '@shared/constants';

// 3. Relative imports
import { calculateSMA } from './utils';
import type { ChartProps } from './types';
```

## 🗄️ Backend Setup

### Database Setup

1. **Install PostgreSQL 17**:
   ```bash
   # macOS
   brew install postgresql@17
   brew services start postgresql@17
   
   # Or use Docker (recommended)
   docker run -d \
     --name marketmind-postgres \
     -e POSTGRES_PASSWORD=your-password \
     -e POSTGRES_DB=marketmind \
     -p 5432:5432 \
     timescale/timescaledb:latest-pg17
   ```

2. **Create database**:
   ```bash
   psql postgres -c "CREATE DATABASE marketmind;"
   ```

3. **Install TimescaleDB**:
   ```bash
   psql marketmind -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
   ```

4. **Configure environment**:
   ```bash
   cd apps/backend
   cp .env.example .env
   # Edit .env with your database credentials
   ```

5. **Run migrations**:
   ```bash
   pnpm db:migrate
   ```

### Database Commands

```bash
cd apps/backend

# Generate migration from schema changes
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Push schema (dev only, skips migrations)
pnpm db:push

# Open Drizzle Studio
pnpm db:studio
```

## 🐛 Reporting Issues

When reporting issues, please include:

- **Description** - Clear description of the problem
- **Steps to reproduce** - Detailed steps to reproduce the issue
- **Expected behavior** - What you expected to happen
- **Actual behavior** - What actually happened
- **Environment** - OS, Node version, pnpm version
- **Screenshots** - If applicable
- **Logs** - Relevant error logs

## 💡 Feature Requests

When requesting features:

- **Use case** - Explain why this feature is needed
- **Proposed solution** - Describe your proposed implementation
- **Alternatives** - Any alternative solutions considered
- **Additional context** - Screenshots, mockups, examples

## 📚 Documentation

When updating documentation:

- **Update CHANGELOG.md** for user-facing changes
- **Update README.md** if project setup changes
- **Add/update JSDoc** for public APIs
- **Update relevant docs/** files
- **Keep examples up-to-date**

## 🤖 AI Development

This project is optimized for AI-assisted development. When using AI tools:

- **Read** `.github/copilot-instructions.md` first
- **Follow** all project guidelines
- **Run tests** after AI-generated code
- **Review** AI suggestions before accepting
- **Test** thoroughly before committing

## ❓ Questions

For questions:

- **Check** existing documentation first
- **Search** existing issues
- **Ask** in discussions (if enabled)
- **Create** new issue if needed

## 🙏 Thank You

Your contributions make MarketMind better for everyone. Thank you for taking the time to contribute!

---

**Last Updated:** November 30, 2025
