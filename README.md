# 📊 MarketMind

> An AI consultant for technical analysis of financial charts

<div align="center">

![Version](https://img.shields.io/badge/version-0.5.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)

</div>

## 🎯 About the Project

**MarketMind** is a desktop application developed in Electron that combines advanced financial chart visualization (candlesticks) with artificial intelligence analysis. The goal is to provide insights on cryptocurrencies, stocks, and other tradable assets, assisting traders and investors in decision-making.

### Key Features

**Currently Implemented:**
- 📈 **Candlestick Charts**: High-performance Canvas rendering with zoom and pan
- 📊 **Line Charts**: Alternative visualization with area fill
- 📊 **Volume Visualization**: Volume bars synchronized with candlesticks
- 📉 **Moving Averages**: MA-9, MA-20, MA-50, MA-100, MA-200 (configurable)
- 🎨 **Grid System**: Dynamic grid with price and time labels
- 🖱️ **Interactive Controls**: Advanced chart settings panel with pin functionality
- ⚙️ **Advanced Settings**: 9 configurable parameters (margins, spacing, grid, etc.)
- 💾 **Persistent Settings**: All configurations saved with localStorage
- 🎯 **Smart Tooltip**: Hover to see OHLCV data with intelligent positioning
- ⏱️ **Timeframe Selector**: 9 timeframes from 1 minute to 1 month
- 🖱️ **Pan & Zoom**: Mouse wheel zoom, drag to pan (horizontal and vertical)
- 🎨 **Dynamic Cursors**: Context-aware cursor feedback
- 🌓 **Dark/Light Themes**: Full Chakra UI theme support
- 🔌 **Real Market Data**: Integration with Binance API for live cryptocurrency data
- 📊 **Symbol Selector**: Search and select from 8 popular cryptocurrencies or search entire catalog
- 🔄 **API Fallback**: Automatic failover to CoinGecko if primary provider fails
- 💾 **Data Caching**: Smart caching system to reduce API calls

**Planned:**
- 🤖 **AI Analysis**: Integration with multiple AI providers (OpenAI, Anthropic, Google Gemini)
- 📰 **News Analysis**: Cross-analysis of technical analysis with news sentiment
- 💬 **Interactive Chat**: Chat with AI about charts in real-time
- 📊 **Technical Indicators**: RSI, MACD, Bollinger Bands, and more
- 🔄 **Auto-Update**: Automatic update system
- 📡 **WebSocket**: Real-time candle updates via WebSocket

## 🛠 Technology Stack

- **TypeScript** - End-to-end typing
- **Electron 39** - Cross-platform desktop framework
- **React 19** - User interface
- **Chakra UI v3** - Components and design system
- **Canvas API** - High-performance chart rendering
- **react-icons** - HeroIcons for UI elements
- **Vite 7** - Optimized build tool

## 📋 Prerequisites

- Node.js >= 18.x
- npm >= 9.x (or pnpm/yarn)
- macOS 10.15+ or Windows 10+

## 🚀 Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/marketmind.git
cd marketmind
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file from the template:

```bash
cp .env.example .env
```

Then add your API keys:

```env
# AI Providers (Vite requires VITE_ prefix)
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_OPENAI_API_KEY=sk-proj-...

# Market APIs (optional)
BINANCE_API_KEY=your_key_here
ALPHA_VANTAGE_API_KEY=your_key_here
```

> 🔒 **Security**: The `.env` file is automatically ignored by Git and will never be committed.  
> 📖 See [docs/API_KEYS_SECURITY.md](docs/API_KEYS_SECURITY.md) for detailed security information.

### 4. Run in development mode

```bash
npm run dev
```

## 📦 Production Build

### Build for your current platform

```bash
npm run build
```

### Platform-specific builds

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Both
npm run build:all
```

Installers will be in `dist-electron/`.

## 🗂 Project Structure

```
marketmind/
├── src/
│   ├── main/              # Electron main process
│   ├── renderer/          # React interface
│   │   ├── components/    # React components
│   │   ├── services/      # Services (AI, market APIs)
│   │   ├── hooks/         # Custom hooks
│   │   └── theme/         # Chakra UI configuration
│   └── shared/            # Shared types and code
├── docs/                  # Documentation
│   ├── IMPLEMENTATION_PLAN.md  # Detailed development plan
│   └── ...
└── package.json
```

## 🎨 Screenshots

> Coming soon...

## 🤝 Contributing

This project is in active development. Contributions are welcome!

1. Fork the project
2. Create a feature branch (`git checkout -b feature/MyFeature`)
3. Commit your changes (`git commit -m 'Add MyFeature'`)
4. Push to the branch (`git push origin feature/MyFeature`)
5. Open a Pull Request

## 📝 Roadmap

See the [IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) file for the detailed project roadmap.

### Current Status (v0.5.0)

**Phase 1: Initial Setup** ✅ COMPLETED
- [x] Vite + Electron + React + TypeScript configuration
- [x] Chakra UI with light/dark theme
- [x] Project structure and TypeScript paths
- [x] ESLint and Prettier setup

**Phase 2: Type System** ✅ COMPLETED
- [x] Candle data types
- [x] Chart configuration types
- [x] AI integration types
- [x] Market provider types

**Phase 3: Chart Rendering** ✅ COMPLETED (100%)
- [x] CanvasManager with zoom/pan system
- [x] Coordinate system utilities
- [x] Candlestick renderer
- [x] Grid renderer with price and time labels
- [x] Volume renderer
- [x] Line chart renderer
- [x] Moving averages (MA-9, MA-20, MA-50, MA-100, MA-200)
- [x] Chart controls UI with switches
- [x] Advanced settings panel
- [x] Pin functionality for quick access
- [x] Settings persistence (localStorage)
- [x] Tooltip with OHLCV data
- [x] Timeframe selector
- [x] Dynamic cursors and UX improvements
- [x] Debounced inputs for performance

**Phase 4: Market API Integration** ✅ COMPLETED (100%)
- [x] Generic provider architecture (BaseMarketProvider)
- [x] Binance API integration (free, no API key)
- [x] CoinGecko fallback provider (free, no API key)
- [x] MarketDataService with caching and failover
- [x] useMarketData React hook
- [x] Real-time market data display
- [x] Symbol selector with search
- [x] 8 popular symbols pre-loaded (BTCUSDT default)
- [x] Loading and error states

### MVP (v1.0) - Target Q1 2026
- [x] Candlestick chart rendering
- [x] Line chart rendering
- [x] Volume chart
- [x] Grid and labels
- [x] 5 moving averages (MA-9, MA-20, MA-50, MA-100, MA-200)
- [x] Advanced chart controls
- [x] Settings persistence
- [x] Tooltip system
- [x] Market API integration (Binance)
- [x] Symbol selector
- [ ] AI integration (OpenAI GPT-4 Vision)
- [ ] Functional AI chat
- [ ] Basic settings panel
- [x] Light and Dark mode
- [ ] Installers (Mac/Windows)
- [ ] Auto-update system

**MVP Progress:** ~60% Complete

### Future (v1.1+)
- [ ] WebSocket for real-time updates
- [ ] More technical indicators (RSI, MACD, Bollinger Bands)
- [ ] Additional market APIs (stocks via Alpha Vantage)
- [ ] Multiple AI providers
- [ ] News integration
- [ ] Price alerts
- [ ] Asset watchlist
- [ ] Symbol favorites and recents
- [ ] Chart export
- [ ] Multi-language support

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Nathan Santos** - *Initial development* - [nathanssantos](https://github.com/nathanssantos)

## 🙏 Acknowledgments

- Electron community
- React and Chakra UI teams
- Market and AI API providers

---

<div align="center">

**[Documentation](./docs/IMPLEMENTATION_PLAN.md)** • 
**[Report Bug](https://github.com/nathanssantos/marketmind/issues)** • 
**[Request Feature](https://github.com/nathanssantos/marketmind/issues)**

Made with ❤️ for traders and investors

</div>
