# MarketMind

> Algorithmic trading assistant with advanced chart visualization and automated setup detection

<div align="center">

![Version](https://img.shields.io/badge/version-1.28.0-blue.svg)
![Tests](https://img.shields.io/badge/tests-8,500%2B%20passing-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)
![i18n](https://img.shields.io/badge/i18n-EN%20%7C%20PT%20%7C%20ES%20%7C%20FR-success.svg)

**[Website](https://marketmind-app.vercel.app)** | **[Documentation](./docs/)** | **[Download](https://github.com/nathanssantos/marketmind/releases)**

</div>

## About the Project

**MarketMind** is a desktop trading workstation for Binance spot and futures. It combines multi-timeframe charts with strategy-driven setup detection, backtesting and auto-trading with risk limits you set. Everything runs on your machine: the installer ships the backend and a PostgreSQL 17 server, starts both when you open the app, and keeps your data and API keys on your computer.

Visit the **[landing page](https://marketmind-app.vercel.app)** for a full overview of features, tech stack, and screenshots.

## Install

1. Download the installer for your platform from the [latest release](https://github.com/nathanssantos/marketmind/releases/latest): `MarketMind-X.Y.Z-arm64.dmg` (macOS Apple Silicon) or `MarketMind-X.Y.Z-x64.exe` (Windows).
2. Open the app. The macOS build is not notarized yet, so allow it once in **System Settings → Privacy & Security**.
3. On first run MarketMind creates its database and starts its trading engine. Create your local account, then a paper wallet to trade with simulated money, or add Binance API keys.

Your data lives in the app's user-data folder (macOS: `~/Library/Application Support/MarketMind/data`, Windows: `%APPDATA%\MarketMind\data`): the PostgreSQL cluster, logs and `strategies/user`, where you can drop your own `.pine` files. **Settings → About → Your data** opens it. Back it up with the app closed. Updates are installed by the app itself from GitHub releases.

Live order execution stays off until `ENABLE_LIVE_TRADING=true` is set for the backend; the embedded backend runs with the defaults, so it trades paper wallets only. Email features (verification, 2FA, password reset) need a `RESEND_API_KEY` and are off in the embedded build.

### Key Features

#### Chart Visualization
- **Kline Charts**: High-performance Canvas rendering with zoom and pan
- **45+ Technical Indicators**: RSI, MACD, Bollinger Bands, Stochastic, ADX, Ichimoku, SuperTrend, VWAP and more
- **Volume Profile**: Price-level volume distribution with POC and buy/sell separation
- **Liquidity Heatmap**: Real-time order book depth visualization with thermal overlay
- **Opening Range Breakout**: Built-in ORB indicator with configurable session boundaries
- **Volume Analysis**: Volume bars synchronized with klines
- **Moving Averages**: SMA, EMA, WMA, DEMA, TEMA (all periods configurable)
- **Drawing Tools**: Lines, arrows, Fibonacci, positions, ruler, and more
- **Grid System**: Dynamic grid with price and time labels
- **Smart Tooltip**: Hover to see OHLCV data with intelligent positioning

#### Trading Strategies (107 Pine Script v5)
- **Built-in library**: breakouts, pullbacks, divergences, mean reversion and momentum, executed by a Pine engine on the backend
- **Your own scripts**: drop `.pine` files into `strategies/user` in the data folder and they load next to the built-in ones
- **Confluence**: per-profile conditions across timeframes, scored before an entry fires
#### Auto-Trading System
- **Algorithmic Execution**: Automated trade execution with OCO orders
- **Risk Management**: Configurable stop-loss, take-profit, position sizing
- **Trend Filter**: EMA-based trend detection (optional counter-trend blocking)
- **Setup Cooldown**: Prevents duplicate detections
- **Real-time Monitoring**: WebSocket live updates from Binance

#### Exchange Stream Resilience
- **Watchdog + Forced Reconnect**: Detects silent Binance WS stream degradation (frame silence > 60s) and forces reconnect with an exponential cooldown
- **Rollover Watchdog**: The chart opens the next bar itself when a close is missed and refetches on silence, holes and reconnects
- **Degradation Indicator**: Pulsing dot in each chart's header panel shows when its stream is degraded, with tooltip explaining the status; hides automatically on recovery

#### Backtesting Engine
- **In the app**: run any strategy on a symbol and timeframe over stored history with fees, filters and a cap on concurrent positions
- **From the CLI**: batch runs across strategies, symbols and timeframes, walk-forward optimization, Monte Carlo and parameter sensitivity (`apps/backend/src/cli`)
- **Performance Metrics**: Win rate, profit factor, Sharpe ratio, max drawdown

#### Market Analysis
- **Screener & Scanners** _(beta)_: Market-wide screening with customizable filters and real-time setup detection
- **Custom Symbols** _(beta)_: Compose user-defined indices from multiple components with weighting strategies (equal, market-cap, capped, sqrt, manual)

#### User Experience
- **Dark/Light Themes**: Full theme support with semantic tokens
- **Keyboard Shortcuts**: drawing, undo/redo, backtest and zoom shortcuts (`?` lists them)
- **Multi-Language**: English, Portuguese, Spanish, French
- **Auto-Update**: Automatic updates via GitHub releases
- **Secure Storage**: API keys encrypted with AES-256 on your computer

#### AI Agent Bridge (MCP)
Five Model Context Protocol servers expose **57 tools** to any MCP client (Claude Code, ChatGPT desktop, custom agents). Install with one command (`pnpm mcp:install`) and drive the app from your AI assistant.
- **`@marketmind/mcp-screenshot`** (6 tools) — Playwright + headless Chromium captures of any tab/modal/sidebar in light + dark, with side-by-side HTML gallery output.
- **`@marketmind/mcp-app`** (19 tools) — drives the live dev app: navigation, symbol/timeframe/chart-type, theme, sidebars, allowlisted toolbar/store dispatch, escape hatches (`click`/`fill`/`waitFor`).
- **`@marketmind/mcp-backend`** (14 tools) — read-only DB layer with per-table query tools, SELECT/CTE-only `db.exec`, tRPC bridge, audit log.
- **`@marketmind/mcp-strategy`** (8 tools) — Pine strategy CRUD + backtest proxies (run/diff/getResult).
- **`@marketmind/mcp-trading`** (10 tools) — paper-wallet order execution behind a per-wallet toggle, a 30 writes/hour limit and an audit log.

Full reference: [`docs/MCP_SERVERS.md`](docs/MCP_SERVERS.md) · agent recipes: [`docs/MCP_AGENT_GUIDE.md`](docs/MCP_AGENT_GUIDE.md) · threat model: [`docs/MCP_SECURITY.md`](docs/MCP_SECURITY.md).

## Technology Stack

### Frontend
- **TypeScript** - End-to-end typing
- **Electron 39** - Cross-platform desktop framework
- **React 19** - User interface
- **Chakra UI v3** - Components and design system
- **Canvas API** - High-performance chart rendering
- **Vite 7** - Optimized build tool

### Backend
- **Fastify 5.6.2** - High-performance HTTP server
- **tRPC 11.7.2** - Type-safe RPC framework
- **Drizzle ORM 0.44.7** - TypeScript SQL ORM
- **PostgreSQL 17** - Relational database
- **TimescaleDB 2.23.1** - Time-series extension
- **Binance SDK 3.1.5** - Trading integration

### Architecture
- **Monorepo** - pnpm workspaces
- **Shared Packages** - 6 packages (@marketmind/types, chart-studies, fibonacci, logger, trading-core, risk, utils)
- **Exchange Abstraction** - Binance (crypto)
- **Real-time API** - Backend server with tRPC endpoints
- **Session Auth** - Secure cookie-based authentication
- **Encrypted Storage** - AES-256-CBC for API keys

## Prerequisites (development)

Using the app needs nothing but the installer. Working on the code needs:

- Node.js >= 24
- pnpm >= 11 (monorepo package manager)
- Docker, for the development PostgreSQL (`docker compose up -d postgres`)
- macOS 10.15+ or Windows 10+

## Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/nathanssantos/marketmind.git
cd marketmind
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Setup PostgreSQL

```bash
# Start the development database (pinned timescale/timescaledb:2.23.1-pg17)
docker compose up -d postgres

# Configure backend environment
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env: DATABASE_URL, ENCRYPTION_KEY (64 hex chars), SESSION_SECRET

# Create the schema
pnpm --filter @marketmind/backend db:migrate
```

`pnpm dev` runs `docker compose up -d postgres` for you when nothing answers on the `DATABASE_URL` port. Schema changes go through the Drizzle schema in `apps/backend/src/db/schema/` plus `pnpm --filter @marketmind/backend db:generate`; the packaged app applies the same migrations at boot.

### 4. Run in development mode

```bash
# Terminal 1: Start backend server
pnpm --filter @marketmind/backend dev

# Terminal 2: Start Electron app
pnpm --filter @marketmind/electron dev
```

Or use the root workspace command:

```bash
# Starts both backend and electron concurrently
pnpm dev
```

## Testing

The project has a comprehensive test infrastructure:

```bash
# Run all tests (unit + browser)
pnpm test

# Run Electron app tests only
pnpm --filter @marketmind/electron test

# Run backend tests only
pnpm --filter @marketmind/backend test

# Run with coverage report
pnpm --filter @marketmind/electron test:coverage

# Run renderer browser tests only (Playwright-backed vitest)
pnpm --filter @marketmind/electron test:browser:run

# Chart perf regression harness (Playwright)
pnpm --filter @marketmind/electron test:perf           # run the perf suite
pnpm --filter @marketmind/electron test:perf:diagnose  # + top-5 bottleneck dump

# Electron IPC / preload / packaged-boot smoke
pnpm --filter @marketmind/electron test:e2e:electron
```

See [`docs/BROWSER_TESTING.md`](docs/BROWSER_TESTING.md) for the full layered-testing picture (Playwright MCP, chart perf harness, Electron smoke) and [`apps/electron/e2e/perf/README.md`](apps/electron/e2e/perf/README.md) for the perf-specific workflow.

**Test Stats:**
- **~7,600+ tests** across the monorepo
- **5,129 backend tests** + 40 skipped — now includes a golden-output snapshot per builtin strategy (106 snapshots)
- **2,400+ frontend tests** (2,341 unit + 92 browser across 6 files)
- **Browser tests** (`apps/electron/src/**/*.browser.test.ts(x)`) cover Canvas pixel math, `getBoundingClientRect` hit-testing, and `CanvasManager` mount/unmount lifecycle — surfaces jsdom can't exercise. Run via `pnpm --filter @marketmind/electron test:browser:run`
- **CI** runs lint, unit tests (with coverage artifact), browser tests, E2E, and backend build on every PR
- All type checks passing

## Production Build

```bash
# From apps/electron: renderer + main, backend bundle, installer
pnpm --filter @marketmind/electron build

# macOS only (DMG + ZIP), Windows only (NSIS installer)
pnpm --filter @marketmind/electron build:mac
pnpm --filter @marketmind/electron build:win
```

The installer bundles the backend (`apps/backend/dist-embedded`, an esbuild bundle with the migrations and the built-in strategies), the renderer build and the PostgreSQL 17 binaries for the target platform (`@embedded-postgres/*`). At runtime the Electron main process starts PostgreSQL from the user-data folder and the backend as a utility process, then loads the renderer from the backend's origin. Details in [`docs/EMBEDDED_BACKEND_PLAN.md`](docs/EMBEDDED_BACKEND_PLAN.md).

Installers are created in `apps/electron/release/`:
- **macOS**: `MarketMind-{version}-arm64.dmg`
- **Windows**: `MarketMind-{version}-x64.exe`

## Project Structure

```
marketmind/
├── apps/
│   ├── electron/          # Desktop application
│   │   ├── src/
│   │   │   ├── main/      # Electron main process
│   │   │   ├── renderer/  # React interface
│   │   │   └── shared/    # Shared code
│   │   └── package.json
│   └── backend/           # Backend server
│       ├── src/
│       │   ├── db/        # Database schema
│       │   ├── routers/   # tRPC routers
│       │   ├── services/  # Business logic
│       │   └── cli/       # CLI tools (backtest)
│       └── package.json
├── packages/
│   ├── types/             # Shared TypeScript types
│   ├── chart-studies/     # Chart study definitions
│   ├── fibonacci/         # Fibonacci calculation engine
│   ├── logger/            # Logging utilities
│   ├── trading-core/      # Core trading logic
│   ├── risk/              # Risk management
│   └── utils/             # General utilities
├── docs/                  # Documentation
│   └── UI_STYLE_GUIDE.md  # UI standardization guide
└── package.json           # Root package
```

## CLI Tools

MarketMind includes a CLI for backtesting:

```bash
cd apps/backend

# Validate a strategy
pnpm backtest validate -s larry-williams-9-1 --symbol BTCUSDT -i 1h --start 2024-01-01 --end 2024-12-01

# Optimize parameters
pnpm backtest optimize -s larry-williams-9-1 --symbol BTCUSDT -i 1h --start 2024-01-01 --end 2024-12-01 --preset balanced

# Run walk-forward analysis
pnpm backtest walkforward -s larry-williams-9-1 --symbol BTCUSDT -i 1h --start 2024-01-01 --end 2024-12-01

# Monte Carlo simulation
pnpm backtest montecarlo -s larry-williams-9-1 --symbol BTCUSDT -i 1h --start 2024-01-01 --end 2024-12-01

# Batch backtest all strategies
pnpm backtest batch --start 2024-01-01 --end 2024-12-01
```

## Contributing

This project is in active development. Contributions are welcome!

1. Fork the project
2. Create a feature branch (`git checkout -b feature/MyFeature`)
3. Commit your changes (`git commit -m 'Add MyFeature'`)
4. Push to the branch (`git push origin feature/MyFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Authors

- **Nathan Santos** - *Initial development* - [nathanssantos](https://github.com/nathanssantos)

---

<div align="center">

**[Website](https://marketmind-app.vercel.app)** |
**[Quick Start](./QUICK_START.md)** |
**[Documentation](./docs/)** |
**[Changelog](./CHANGELOG.md)** |
**[Report Bug](https://github.com/nathanssantos/marketmind/issues)**

Made with love for traders and investors

</div>
