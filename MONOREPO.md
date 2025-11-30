# MarketMind Monorepo

This is the monorepo structure for the MarketMind project, containing both the Electron desktop app and the backend API server.

## Structure

```
marketmind/
├── apps/
│   ├── electron/          # Electron desktop application
│   └── backend/           # Fastify + tRPC backend API
└── packages/
    ├── types/             # Shared TypeScript types
    ├── indicators/        # Technical analysis indicators
    └── utils/             # Shared utilities (planned)
```

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (installed automatically via npm)
- PostgreSQL 14+ with TimescaleDB extension (for backend)

### Installation

```bash
# Install all dependencies
pnpm install
```

### Development

```bash
# Run Electron app only
pnpm dev

# Run backend only
pnpm dev:backend

# Run both simultaneously
pnpm dev:all
```

### Building

```bash
# Build Electron app
pnpm build

# Build backend
pnpm build:backend

# Build everything
pnpm build:all
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in a specific workspace
pnpm --filter @marketmind/electron test
pnpm --filter @marketmind/backend test
```

## Backend Setup

### 1. Install PostgreSQL 16 + TimescaleDB

**macOS (Homebrew):**
```bash
brew tap timescale/tap
brew install postgresql@16 timescaledb
brew services start postgresql@16
```

**Ubuntu/Debian:**
```bash
sudo apt install postgresql-16 postgresql-16-timescaledb
sudo systemctl start postgresql
```

### 2. Create Database

```bash
psql -U postgres
CREATE DATABASE marketmind;
CREATE USER marketmind WITH PASSWORD 'your_password_here';
GRANT ALL PRIVILEGES ON DATABASE marketmind TO marketmind;
\c marketmind
CREATE EXTENSION IF NOT EXISTS timescaledb;
\q
```

### 3. Configure Environment

```bash
cd apps/backend
cp .env.example .env
# Edit .env with your database credentials and secrets
```

Generate encryption key (32 bytes = 64 hex chars):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Generate session secret (64+ chars):
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

### 4. Run Migrations

```bash
pnpm --filter @marketmind/backend db:generate
pnpm --filter @marketmind/backend db:migrate
```

### 5. Start Backend

```bash
pnpm dev:backend
```

Backend will be available at `http://localhost:3001`

## Technology Stack

### Latest Versions (November 2025)

**Backend:**
- Fastify 5.6.2
- tRPC 11.7.2
- Drizzle ORM 0.44.7
- Drizzle Kit 0.31.7
- PostgreSQL 16+
- TimescaleDB 2.x
- Argon2 (@node-rs/argon2 2.0.0)
- Binance SDK 3.1.5
- Socket.io 4.8.1
- Zod 3.24.1

**Frontend (Electron):**
- Electron 39.2.4
- React 19.2.0
- Chakra UI 3.30.0
- Vite 7.2.4
- TypeScript 5.9.3

**Shared:**
- pnpm 10.24
- Vitest 4.0.14

## Workspace Commands

```bash
# Run command in specific workspace
pnpm --filter @marketmind/electron <command>
pnpm --filter @marketmind/backend <command>
pnpm --filter @marketmind/types <command>

# Run command in all workspaces
pnpm -r <command>

# Run command in parallel
pnpm --parallel <command>

# Clean all node_modules
pnpm clean
```

## Package Dependencies

Packages can depend on each other using workspace protocol:

```json
{
  "dependencies": {
    "@marketmind/types": "workspace:*",
    "@marketmind/indicators": "workspace:*"
  }
}
```

## Migration from Legacy Structure

The project was migrated from a single-package structure to a monorepo:

- **Before:** All code in `/src`
- **After:** 
  - Electron app in `/apps/electron`
  - Backend in `/apps/backend`
  - Shared code in `/packages/*`

The Electron app remains fully functional and can run independently during the gradual backend integration.

## Next Steps

1. ✅ Monorepo structure setup
2. ✅ Shared packages created (types, indicators)
3. ✅ Backend scaffolding with Fastify + tRPC
4. ⏳ Database schema implementation
5. ⏳ Authentication with Lucia
6. ⏳ Trading API integration
7. ⏳ Frontend migration to tRPC client

## Documentation

- [Backend Implementation Plan](./docs/BACKEND_IMPLEMENTATION_PLAN.md)
- [Original Implementation Plan](./docs/IMPLEMENTATION_PLAN.md)
- [Git Commands](./docs/GIT_COMMANDS.md)
- [Build Documentation](./docs/BUILD.md)

## License

MIT - See [LICENSE](./LICENSE) file
