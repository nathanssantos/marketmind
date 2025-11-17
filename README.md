# 📊 MarketMind

> An AI consultant for technical analysis of financial charts

<div align="center">

![Version](https://img.shields.io/badge/version-0.14.0-blue.svg)
![Tests](https://img.shields.io/badge/tests-592%20passing-brightgreen.svg)
![Coverage](https://img.shields.io/badge/coverage-90.62%25-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)
![i18n](https://img.shields.io/badge/i18n-EN%20%7C%20PT%20%7C%20ES-success.svg)

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
- 🌓 **Dark/Light Themes**: Full Chakra UI theme support with 24 chart-specific semantic tokens
- 🎨 **Theme Integration**: Complete color system integration (all chart colors from theme)
- 🔌 **Real Market Data**: Integration with Binance API for live cryptocurrency data
- 📊 **Symbol Selector**: Search and select from 8 popular cryptocurrencies or search entire catalog
- 🔄 **API Fallback**: Automatic failover to CoinGecko if primary provider fails
- 💾 **Data Caching**: Smart caching system to reduce API calls
- 🤖 **AI Chat Interface**: Full chat system with 10 AI models (OpenAI, Claude, Gemini)
- 💬 **Interactive Sidebar**: Resizable chat sidebar (300-800px) with markdown rendering
- 📊 **Chart Data Integration**: Sends structured data (100 candles + statistics) instead of images
- 🎨 **Theme System**: Enhanced dark mode with semantic tokens
- ⚙️ **AI Selector**: Provider and model selection with pricing info
- 📝 **Message History**: Clean UI with auto-scroll and loading states
- 🔐 **Secure Storage**: Platform-native encryption for API keys (Keychain/DPAPI/libsecret)
- ⚙️ **Settings System**: Comprehensive settings with AI, news, and general configuration
- 📰 **News Integration**: Multi-provider news aggregation (NewsAPI, CryptoPanic, Finnhub)
- 🔄 **Auto-Update System**: Automatic updates via GitHub releases with progress tracking
- 🎨 **UI/UX Polish**: Smooth loading states, error messages, and visual feedback
- 🎓 **Onboarding**: First-time user welcome tour with step-by-step introduction
- ⌨️ **Keyboard Shortcuts**: Full keyboard navigation with customizable shortcuts
- 🔍 **Tooltips**: Contextual help and information throughout the interface
- ♿ **Accessibility**: ARIA labels, keyboard support, and screen reader compatibility
- 🎯 **Performance**: Web Workers for heavy calculations, IndexedDB caching
- 🌍 **Internationalization**: Multi-language support (English, Portuguese, Spanish, French)
- 🔄 **Language Detection**: Automatic language detection from browser/system
- ⚙️ **Language Selector**: Manual language switching in settings

**Planned:**
- 📰 **News Sentiment Analysis**: AI-powered sentiment analysis of financial news
- 📊 **Technical Indicators**: RSI, MACD, Bollinger Bands, and more
- 📡 **WebSocket**: Real-time candle updates via WebSocket
- 🧪 **Testing**: Comprehensive unit and integration tests
- 🌐 **More Languages**: German, Japanese, Chinese support

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

## 🧪 Testing

The project has a comprehensive test infrastructure with 592 passing tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:ui

# Run with coverage report
npm run test:coverage
```

**Test Coverage:** ✅ EXCELLENT (Phase 11 - 100% complete)
- **592 tests** passing (100% pass rate)
- **90.62%** overall coverage (exceeded 80% target! 🎉)
- **69 tests** for utility functions (96.3% coverage ✅)
- **161 tests** for React hooks (87.27% coverage ✅)
- **277 tests** for service layer (91.3% coverage ✅)
- **85 tests** for components (100% coverage ✅)

**All Critical Paths Tested:**
- ✅ Test infrastructure (Vitest 4.0.9 + React Testing Library)
- ✅ Utility tests (formatters, moving averages, coordinate system, canvas)
- ✅ Hook tests (all custom hooks with dependency injection)
- ✅ Service layer (AI providers, market data, news aggregation)
- ✅ Component tests (SymbolSelector, ChartContext)
- ✅ Cache layer (IndexedDB integration)

**Production Ready:** All features tested and verified! 🚀

See [Testing Documentation](./docs/IMPLEMENTATION_PLAN.md#phase-11-testing--quality-assurance-) for details.

## 🎨 Theme System

MarketMind features a comprehensive theme color system with full light/dark mode support:

- **24+ Semantic Tokens**: Chart-specific colors with light/dark variants
- **Single Source of Truth**: All colors defined in theme configuration
- **Reactive Theming**: Chart responds automatically to theme changes
- **Type Safety**: Full TypeScript support with `ChartThemeColors` interface

See [docs/THEME_COLORS.md](docs/THEME_COLORS.md) for detailed theme documentation.

## 📦 Production Build

See [docs/BUILD.md](docs/BUILD.md) for detailed build instructions.

### Quick Start

```bash
# Build for current platform
npm run build

# macOS only (DMG)
npm run build:mac

# Windows only (NSIS installer)
npm run build:win

# All platforms
npm run build:all
```

Installers will be created in `dist/`:
- **macOS**: `MarketMind-{version}.dmg`
- **Windows**: `MarketMind-Setup-{version}.exe`

### Code Signing (Optional)

For signed installers, set environment variables:

**macOS:**
```bash
export APPLE_ID="your-apple-id@email.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="your-team-id"
```

**Windows:**
```bash
export CSC_LINK="path/to/certificate.pfx"
export CSC_KEY_PASSWORD="certificate-password"
```

See [docs/BUILD.md](docs/BUILD.md) for complete signing instructions.

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

### Current Status (v0.14.0)

**Phase 1: Initial Setup** ✅ COMPLETED (100%)
- [x] Vite + Electron + React + TypeScript configuration
- [x] Chakra UI with light/dark theme
- [x] Project structure and TypeScript paths
- [x] ESLint and Prettier setup

**Phase 2: Type System** ✅ COMPLETED (100%)
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

**Phase 5: AI System** ✅ COMPLETED (100%)
- [x] BaseAIProvider abstract class
- [x] OpenAIProvider (2 models: GPT-4o, GPT-4o Mini)
- [x] ClaudeProvider (3 models: Sonnet 4.5, Haiku 4.5, Opus 4.1)
- [x] GeminiProvider (4 models: 2.0 Flash Exp FREE, 1.5 Pro/Flash/Flash-8B)
- [x] AIService with provider factory
- [x] aiStore with Zustand
- [x] useAI hook with model tracking
- [x] Environment variable management
- [x] Complete documentation (3 model guides)
- [x] 10 total AI models available
- [x] FREE tier option (Gemini)

**Phase 6: AI Chat Interface** ✅ COMPLETED (100%)
- [x] MainLayout with resizable sidebar (300-800px)
- [x] Header with AI selector, theme toggle, settings
- [x] ChatSidebar with open/close functionality
- [x] MessageList with markdown rendering
- [x] MessageInput with chart data integration
- [x] ChartContext for data sharing
- [x] Chart data formatting (100 candles + statistics)
- [x] Theme system with semantic tokens
- [x] UI polish (padding, colors, backgrounds)
- [x] Correct Claude API model IDs
- [x] Clean separation (data in API calls only)

**Phase 7: Settings System** ✅ COMPLETED (100%)
- [x] electron-store integration
- [x] Platform-native encryption (Keychain/DPAPI/libsecret)
- [x] Multi-provider support (OpenAI, Anthropic, Gemini)
- [x] Automatic migration from localStorage
- [x] 7 IPC handlers for secure operations
- [x] useSecureStorage React hook
- [x] Updated AIConfigTab with encrypted inputs

**Phase 8: News Integration** ✅ COMPLETED (100%)
- [x] Multi-provider news system (NewsAPI, CryptoPanic)
- [x] NewsService with caching and fallback
- [x] useNews hook for React integration
- [x] NewsPanel component with sentiment badges
- [x] NewsConfigTab settings interface
- [x] Secure storage for news API keys
- [x] Migration from localStorage
- [x] AI integration with news context

**Phase 9: Build & Deploy System** ✅ COMPLETED (100%)
- [x] electron-builder configuration
- [x] macOS build (DMG installer)
- [x] Windows build (NSIS installer)
- [x] Placeholder icon generation
- [x] Code signing preparation
- [x] Build scripts (build:mac, build:win, build:all)
- [x] Complete build documentation

**Phase 10: Auto-Update System** ✅ COMPLETED (100%)
- [x] UpdateManager service
- [x] GitHub releases integration
- [x] UpdateNotification component
- [x] Download progress tracking
- [x] Settings integration
- [x] IPC communication
- [x] Complete documentation (AUTO_UPDATE.md)
- [x] ESM/CommonJS compatibility fixes

**Phase 11: Testing & Quality Assurance** ✅ COMPLETED (100%)
- [x] Test infrastructure setup (Vitest 4.0.9)
- [x] Utility function tests (69 tests, 96.3% coverage)
- [x] React hook tests (161 tests, 87.27% coverage)
- [x] Service layer tests (277 tests, 91.3% coverage)
- [x] Component tests (74 tests, 100% coverage)
- [x] Dependency injection refactoring
- [x] Overall coverage: 90.62% (exceeded 80% target!)
- [x] 581 tests passing with 100% pass rate

**Phase 12: Optimizations & Performance** ✅ COMPLETED (100%)
- [x] Canvas performance (requestAnimationFrame)
- [x] IndexedDB persistent cache
- [x] Web Workers for heavy calculations
- [x] Memory management and cleanup
- [x] Chat history limits (100 messages/conversation)
- [x] Conversation limits (50 conversations)
- [x] Dual-layer caching (memory + IndexedDB)

**Phase 13: Final Polish** ✅ COMPLETED (100%)
- [x] UI/UX Polish
  - [x] Smooth loading states with spinner
  - [x] Enhanced error messages with retry
  - [x] Tooltips throughout interface
  - [x] Onboarding dialog for first-time users
- [x] Accessibility
  - [x] Keyboard shortcuts system
  - [x] Keyboard shortcuts dialog
  - [x] ARIA labels on all interactive elements
  - [x] Full keyboard navigation support
- [x] Documentation
  - [x] Keyboard shortcuts guide
  - [x] Updated README with all features
  - [x] Test coverage documentation

**Phase 14: Internationalization** ✅ COMPLETED (100%)
- [x] i18next + react-i18next integration
- [x] Multi-language support (English, Portuguese, Spanish, French)
- [x] 250+ translation keys covering all components
- [x] Automatic language detection from browser/system
- [x] Language selector in Settings → General
- [x] All UI components fully translated
- [x] Persistent language preference in localStorage
- [x] All JSX comments removed for cleaner code
- [x] Test suite updated for English error messages

### MVP (v1.0) - Target Q1 2025
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
- [x] AI integration (10 models: OpenAI, Claude, Gemini)
- [x] Functional AI chat with markdown
- [x] Chart data integration with AI
- [x] Settings modal with API key encryption
- [x] Light and Dark mode
- [x] News integration
- [x] Build system (macOS and Windows installers)
- [x] Auto-update system
- [x] Test coverage 90.62% (exceeded 80% target! ✅)
- [x] UI/UX polish with smooth animations
- [x] Onboarding for first-time users
- [x] Keyboard shortcuts system
- [x] Accessibility features
- [x] Multi-language support (EN, PT, ES, FR with 255+ keys)

**MVP Progress:** 100% Complete (production ready! 🚀)

### Future (v1.1+)
- [ ] WebSocket for real-time updates
- [ ] More technical indicators (RSI, MACD, Bollinger Bands)
- [ ] Additional market APIs (stocks via Alpha Vantage)
- [ ] Price alerts
- [ ] Asset watchlist
- [ ] Symbol favorites and recents
- [ ] Chart export as images
- [ ] More languages (DE, JP, CN)
- [ ] Integration and E2E tests

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
