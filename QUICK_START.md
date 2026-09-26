# ⚡ MarketMind - Quick Start Guide

Get MarketMind up and running in 5 minutes.

> Want to **use** the app rather than work on it? Download the installer from the [latest release](https://github.com/nathanssantos/marketmind/releases/latest). It ships the backend and PostgreSQL and needs nothing else. This guide is the developer path.

## 📋 Prerequisites

- **Node.js** 24+ ([Download](https://nodejs.org/))
- **pnpm** 11+ ([Install](https://pnpm.io/installation))
- **PostgreSQL** 17 ([Download](https://www.postgresql.org/download/) or use Docker)

## 🚀 Installation

### 1. Clone Repository

```bash
git clone https://github.com/nathanssantos/marketmind.git
cd marketmind
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Setup Database

**Option A: Docker (Recommended)**
```bash
docker compose up -d postgres
```
This uses the repo `docker-compose.yml`: pinned `timescale/timescaledb:2.23.1-pg17`, data in the named volume `marketmind_postgres_data`, `restart: unless-stopped`. `pnpm dev` and `pnpm dev:backend` run this step for you whenever nothing answers on the `DATABASE_URL` port.

**Option B: Local PostgreSQL**
```bash
# macOS
brew install postgresql@17
brew services start postgresql@17

# Create database
psql postgres -c "CREATE DATABASE marketmind;"
psql marketmind -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
```
A `brew upgrade` that replaces or removes `postgresql@17` stops the database until you reinstall it. Option A keeps the image pinned and the data in a Docker volume.

### 4. Configure Backend

```bash
cd apps/backend

# Copy environment template
cp .env.example .env

# Generate encryption keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Edit .env and paste the generated keys
nano .env
```

**Minimal .env:**
```bash
DATABASE_URL=postgresql://marketmind:marketmind_dev_password@localhost:5432/marketmind
SESSION_SECRET=paste-first-generated-key-here
ENCRYPTION_KEY=paste-second-generated-key-here
```

### 5. Run Migrations

```bash
# Still in apps/backend
pnpm db:migrate
cd ../..
```

## 🎯 Development

### Start Backend (Terminal 1)

```bash
pnpm dev:backend
```

Wait for: `🚀 Backend server running on http://localhost:3001`

### Start Frontend (Terminal 2)

```bash
pnpm dev:electron
```

Wait for Electron window to open.

## ✅ Verify Installation

```bash
# Run all tests (must show 100% pass rate)
pnpm test
```

Expected output:
```
✓ Test Files  7 passed (backend)
✓ Test Files  105+ passed (frontend)
  Tests  1920+ passed
```

## 🔧 Common Issues

### Port 3001 Already in Use

```bash
# macOS/Linux
lsof -ti:3001 | xargs kill -9

# Then restart backend
pnpm dev:backend
```

### Database Connection Failed

```bash
# Check the compose container
docker compose ps postgres
docker compose logs --tail 50 postgres

# Start it (pnpm dev does this automatically)
docker compose up -d postgres

# Check .env DATABASE_URL matches your setup
cat apps/backend/.env | grep DATABASE_URL
```

### Tests Failing

```bash
# Clean and reinstall
pnpm clean
rm -rf node_modules
pnpm install

# Run tests again
pnpm test
```

### pnpm Not Found

```bash
# Install pnpm globally
npm install -g pnpm

# Verify installation
pnpm --version
```

## 📚 Next Steps

- **Read** [README.md](README.md) for full documentation
- **Review** [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines
- **Check** `.github/copilot-instructions.md` for AI development tips
- **Explore** `docs/` folder for detailed guides

## 🎮 Key Commands

```bash
# Development
pnpm dev:backend        # Start backend server
pnpm dev:electron       # Start Electron app

# Testing
pnpm test              # Run all tests
pnpm test:coverage     # Run with coverage

# Building
pnpm build:backend     # Build backend
pnpm build:electron    # Build Electron app

# Database
cd apps/backend
pnpm db:migrate        # Apply migrations
pnpm db:studio         # Open Drizzle Studio
pnpm db:generate       # Generate new migration

# Utilities
pnpm lint              # Lint all code
pnpm type-check        # Check TypeScript
pnpm clean             # Clean build artifacts
```

## 🆘 Getting Help

- **Issues**: [GitHub Issues](https://github.com/nathanssantos/marketmind/issues)
- **Docs**: See `docs/` folder
- **AI Help**: Check `.github/copilot-instructions.md`

## ✨ You're Ready!

MarketMind is now running. Happy coding! 🚀

---

**Estimated Setup Time:** 5-10 minutes  
**Last Updated:** April 2026
