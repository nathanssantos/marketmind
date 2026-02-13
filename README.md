# MarketMind

> Algorithmic trading assistant with advanced chart visualization and automated setup detection

<div align="center">

![Version](https://img.shields.io/badge/version-0.36.0-blue.svg)
![Tests](https://img.shields.io/badge/tests-1,930%20passing-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)
![i18n](https://img.shields.io/badge/i18n-EN%20%7C%20PT%20%7C%20ES%20%7C%20FR-success.svg)

</div>

## About the Project

**MarketMind** is a desktop application developed in Electron that combines advanced financial chart visualization (klines) with algorithmic setup detection. The goal is to provide automated trading insights on cryptocurrencies through mathematical pattern recognition and backtested strategies.

### Key Features

#### Chart Visualization
- **Kline Charts**: High-performance Canvas rendering with zoom and pan
- **25+ Technical Indicators**: RSI, MACD, Bollinger Bands, Stochastic, ADX, and more
- **Volume Analysis**: Volume bars synchronized with klines
- **Moving Averages**: SMA, EMA, WMA, DEMA, TEMA (all periods configurable)
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

#### Backtesting Engine
- **Historical Testing**: Test strategies on historical data
- **Walk-Forward Optimization**: Parameter optimization with out-of-sample validation
- **Monte Carlo Simulation**: Statistical analysis of strategy robustness
- **Batch Backtesting**: Test multiple strategies across symbols and timeframes
- **Performance Metrics**: Win rate, profit factor, Sharpe ratio, max drawdown

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
- **Shared Packages** - @marketmind/types, @marketmind/indicators
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
```

**Test Stats:**
- **1,903 unit tests** passing
- **27 browser tests** passing
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
│   └── indicators/        # Technical analysis utilities
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

**[Quick Start](./QUICK_START.md)** |
**[Documentation](./docs/)** |
**[Changelog](./CHANGELOG.md)** |
**[Report Bug](https://github.com/nathanssantos/marketmind/issues)**

Made with love for traders and investors

</div>
