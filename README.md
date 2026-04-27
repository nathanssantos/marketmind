# MarketMind

> Algorithmic trading assistant with advanced chart visualization and automated setup detection

<div align="center">

![Version](https://img.shields.io/badge/version-0.111.0-blue.svg)
![Tests](https://img.shields.io/badge/tests-7,500%2B%20passing-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)
![i18n](https://img.shields.io/badge/i18n-EN%20%7C%20PT%20%7C%20ES%20%7C%20FR-success.svg)

**[Website](https://marketmind-app.vercel.app)** | **[Documentation](./docs/)** | **[Download](https://github.com/nathanssantos/marketmind/releases)**

</div>

## About the Project

**MarketMind** is a desktop application developed in Electron that combines advanced financial chart visualization (klines) with algorithmic setup detection. The goal is to provide automated trading insights on cryptocurrencies through mathematical pattern recognition and backtested strategies.

Visit the **[landing page](https://marketmind-app.vercel.app)** for a full overview of features, tech stack, and screenshots.

### Key Features

#### Chart Visualization
- **Kline Charts**: High-performance Canvas rendering with zoom and pan
- **35+ Technical Indicators**: RSI, MACD, Bollinger Bands, Stochastic, ADX, and more (powered by PineTS)
- **Volume Profile**: Price-level volume distribution with POC, Value Area, and buy/sell separation
- **Liquidity Heatmap**: Real-time order book depth visualization with thermal overlay
- **Opening Range Breakout**: Built-in ORB indicator with configurable session boundaries
- **Volume Analysis**: Volume bars synchronized with klines
- **Moving Averages**: SMA, EMA, WMA, DEMA, TEMA (all periods configurable)
- **Drawing Tools**: Lines, arrows, Fibonacci, positions, ruler, and more
- **Grid System**: Dynamic grid with price and time labels
- **Smart Tooltip**: Hover to see OHLCV data with intelligent positioning

#### Trading Strategies (17 Setups)
- **Larry Williams Suite**: Setup 9.1, 9.2, 9.3, 9.4 (EMA9-based reversals and pullbacks)
- **Momentum Strategies**: Williams Momentum, TEMA Momentum, PPO Momentum
- **Breakout Strategies**: Keltner Breakout, Bollinger Breakout, Momentum Breakout 2025
- **Trend Following**: Supertrend Follow, Parabolic SAR Crypto
- **Oscillator-Based**: Elder Ray Crypto, Stochastic Double Touch, Percent-B Connors
- **Reversal Patterns**: Triple Confirmation Reversal, Momentum Rotation

#### Auto-Trading System
- **Algorithmic Execution**: Automated trade execution with OCO orders
- **Risk Management**: Configurable stop-loss, take-profit, position sizing
- **Trend Filter**: EMA-based trend detection (optional counter-trend blocking)
- **Setup Cooldown**: Prevents duplicate detections
- **Real-time Monitoring**: WebSocket live updates from Binance

#### Exchange Stream Resilience
- **Watchdog + Forced Reconnect**: Detects silent Binance WS stream degradation (frame silence > 60s) and forces reconnect per subscription
- **Synthesized Klines**: When aggregated streams (`@kline`, `@aggTrade`, `@markPrice`) stop emitting but `@trade` stays alive, constructs OHLCV candles in real time from trade ticks so the chart never freezes during partial outages
- **Degradation Indicator**: Pulsing dot in each chart's header panel shows when its stream is degraded, with tooltip explaining the status; hides automatically on recovery

#### Backtesting Engine
- **Historical Testing**: Test strategies on historical data
- **Walk-Forward Optimization**: Parameter optimization with out-of-sample validation
- **Monte Carlo Simulation**: Statistical analysis of strategy robustness
- **Batch Backtesting**: Test multiple strategies across symbols and timeframes
- **Performance Metrics**: Win rate, profit factor, Sharpe ratio, max drawdown

#### Market Analysis
- **Screener & Scanners** _(beta)_: Market-wide screening with customizable filters and real-time setup detection
- **Custom Symbols** _(beta)_: Compose user-defined indices from multiple components with weighting strategies (equal, market-cap, capped, sqrt, manual)
- **Footprint Chart**: Intra-bar bid/ask volume split visualization

#### User Experience
- **Dark/Light Themes**: Full theme support with semantic tokens
- **Keyboard Shortcuts**: Full keyboard navigation
- **Multi-Language**: English, Portuguese, Spanish, French
- **Auto-Update**: Automatic updates via GitHub releases
- **Secure Storage**: Platform-native encryption for API keys

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

## Prerequisites

- Node.js >= 18.x
- pnpm >= 9.x (monorepo package manager)
- macOS 10.15+ or Windows 10+
- PostgreSQL 17 + TimescaleDB 2.23.1 (for backend)

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

### 3. Setup PostgreSQL + TimescaleDB

```bash
# Install PostgreSQL 17 and TimescaleDB
brew install postgresql@17 timescaledb

# Create database
psql postgres
CREATE DATABASE marketmind;
CREATE USER marketmind WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE marketmind TO marketmind;
\c marketmind
CREATE EXTENSION IF NOT EXISTS timescaledb;
\q

# Configure backend environment
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env with your database credentials

# Run migrations
pnpm --filter @marketmind/backend db:migrate
```

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
# Build for current platform
pnpm build

# macOS only (DMG)
pnpm build:mac

# Windows only (NSIS installer)
pnpm build:win
```

Installers will be created in `dist/`:
- **macOS**: `MarketMind-{version}.dmg`
- **Windows**: `MarketMind-Setup-{version}.exe`

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
