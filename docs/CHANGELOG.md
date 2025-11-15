# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **OpenAI Models Documentation**: Complete guide for GPT-4o and GPT-4o Mini
  - OPENAI_MODELS.md with specifications and pricing
  - Best practices and optimization tips
  - Code examples and configuration guide
  - Comparison with other providers
  - Common issues and troubleshooting
- **Google Gemini Integration**: Full support for Google's Gemini AI models
  - GeminiProvider with 4 models:
    - Gemini 2.0 Flash Exp (FREE) - Experimental model
    - Gemini 1.5 Pro ($1.25/$5) - Best quality, 2M context window
    - Gemini 1.5 Flash ($0.075/$0.30) - Fast and balanced
    - Gemini 1.5 Flash-8B ($0.0375/$0.15) - Cheapest paid option
  - Vision API with inline data support
  - Chat history management
  - Multimodal capabilities (text, images, video)
  - Complete documentation in GEMINI_MODELS.md
  - FREE tier available with Gemini 2.0 Flash Exp
  - SDK: @google/generative-ai
- **AI System Integration**: Multi-provider AI architecture (95% complete)
  - BaseAIProvider abstract class with centralized prompt management
  - OpenAIProvider with GPT-4o and GPT-4o Mini models
  - ClaudeProvider with 6 models:
    - Claude 4.5 Sonnet ($3/$15) - Best balance
    - Claude 4.5 Haiku ($1/$5) - Fastest
    - Claude 4.1 Opus ($15/$75) - Most capable
    - Claude 3.7 Sonnet ($3/$15)
    - Claude 3.5 Sonnet ($3/$15)
    - Claude 3.5 Haiku ($0.80/$4) - Cheapest option
  - AIService with provider factory pattern
  - aiStore (Zustand) for conversation and settings management
  - useAI hook with message tracking and model versioning
  - AITest component with full configuration UI
  - Environment variable support (.env with VITE_ prefix)
  - API key auto-fill from environment variables
  - Model selector with pricing information
  - Configurable temperature (0-2) and max tokens (256-64000)
  - "Change Settings" without clearing chat history
  - Model tracking in conversation messages
  - Successfully tested with Claude 4.5 Sonnet API
  - Comprehensive documentation (CLAUDE_MODELS.md, API_KEYS_SECURITY.md)
  - Secure API key handling with .gitignore protection
  - System prompt management via prompts.json
  - Signal parsing for trading signals (STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL)

### Changed
- **Code Refactoring**: AITest component optimization
  - Replaced all nested ternary operators with useMemo
  - Computed values: apiKeyEnvVar, defaultModel, apiKeyPlaceholder, providerDisplayName, pricingInfo, modelOptions
  - Cleaner, more maintainable code structure
  - Better performance with memoized values
  - Removed all code comments for cleaner codebase
- **AI Provider Support**: Expanded from 2 to 3 providers
  - Total of 12 AI models now available
  - 2 GPT models (OpenAI)
  - 6 Claude models (Anthropic)
  - 4 Gemini models (Google)
- **Environment Variables**: Added VITE_GEMINI_API_KEY
  - Updated .env.example with Gemini instructions
  - Auto-fill support for all three providers

### Dependencies
- Added @google/generative-ai for Gemini integration

- **WebSocket Real-Time Updates**: Live candle updates via Binance WebSocket
  - subscribeToUpdates method in MarketDataService
  - useRealtimeCandle hook for React integration
  - Automatic merging of live data with historical candles
  - Smart update handling (update vs. new candle detection)
  - WebSocket connection management and cleanup
  - Support for multiple simultaneous subscriptions
  - Automatic reconnection on disconnect
  - Complete documentation in services/market/README.md
- **Market Data API Integration**: Generic provider architecture
  - BaseMarketProvider abstract class for extensibility
  - BinanceProvider for real cryptocurrency data (free, no API key)
  - CoinGeckoProvider as fallback (free, no API key)
  - MarketDataService with automatic fallback and caching
  - useMarketData hook for React components
  - Real-time candlestick data from Binance API
  - Support for all timeframes (1m to 1M)
  - Error handling with automatic provider fallback
  - Response caching (60s duration)
  - Loading and error states in UI
  - Documentation in services/market/README.md
- **Symbol Selector**: Asset selection component
  - SymbolSelector component with search functionality
  - useSymbolSearch hook with debouncing
  - 8 popular cryptocurrencies pre-loaded (BTC, ETH, BNB, SOL, ADA, XRP, DOGE, DOT)
  - BTCUSDT as default symbol
  - Real-time symbol search via Binance API
  - Dropdown with click-outside detection
  - Symbol persistence in localStorage
  - Clean UI with Chakra components

### Changed
- Chart now displays real market data instead of sample data
- App.tsx integrated with MarketDataService
- Symbol can be changed via SymbolSelector in top-right corner
- Added loading spinner during data fetch
- Added error message display on API failures

### In Progress
- AI chat interface sidebar
- Chart analysis integration with AI
- Full conversation UI

### Dependencies
- Added @anthropic-ai/sdk v0.69.0 for Claude integration
- Added @google/generative-ai for Gemini integration

## [0.5.0] - 2025-11-15

### Added
- **Advanced Controls Panel**: 9 configurable chart settings
  - Right margin adjustment
  - Volume height ratio
  - Candle spacing and wick width
  - Grid line width
  - Padding controls (top, bottom, left, right)
- **Pin Functionality**: Pin favorite controls for quick access
- **Quick Settings Section**: Dynamic section showing pinned controls
- **Settings Persistence**: All configurations saved with localStorage
- **TimeframeSelector Component**: 9 timeframe options (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w, 1M)
- **Enhanced Moving Averages**: Added MA-100 and MA-200 (total: 5 MAs)
- **Smart Tooltip**: OHLCV data on hover with intelligent positioning
  - Hides when hovering over price/time scales
  - Auto-positions to stay within chart bounds
- **Dynamic Cursors**: Context-aware cursor feedback
  - `ns-resize` cursor on price scale for vertical pan/zoom
  - `crosshair` cursor on chart area
- **Reusable Components**:
  - `ControlPanel`: Collapsible panel container
  - `PinnableControl`: Control with hover-activated pin button
  - `ControlPanelGroup`: Stack container for multiple panels
- **Custom Hooks**:
  - `useDebounce`: Generic debounce hook (300ms delay)
  - `useLocalStorage`: localStorage wrapper matching useState API
- **Context API**: `PinnedControlsContext` for global pin state management

### Changed
- Chart controls now use switches instead of icon buttons
- All icons replaced with HeroIcons from react-icons
- Text selection disabled globally for better UX
- Panel layout changed to vertical stack (flex column)
- CanvasManager enhanced with dynamic rightMargin support
- All chart renderers now accept optional advanced config props

### Fixed
- Right margin now properly pushes candles left instead of hiding them
- Moving averages rendering optimized with debounced inputs
- Tooltip positioning improved to prevent overflow
- Performance optimizations with debounced state updates

### Technical
- Global CSS: `userSelect: 'none'` for all text
- Stack layout for control panels
- Advanced configuration passed to all renderers
- Debouncing prevents excessive re-renders on input changes

## [0.3.0] - 2025-11-14

### Added
- LineRenderer for line chart visualization
- Line chart with area fill below the line
- Moving average calculations (SMA and EMA)
- MovingAverageRenderer for displaying moving averages on chart
- ChartControls component with interactive toggles
- Support for switching between candlestick and line chart types
- Configurable moving averages (EMA-9, SMA-20, SMA-50)
- Toggle controls for volume, grid, and indicators
- Full-screen chart mode
- useLineChartRenderer hook with area fill
- useMovingAverageRenderer hook using manager coordinate methods
- State management for chart display options

### Fixed
- Moving average rendering now uses manager coordinate methods (indexToX, priceToY)
- Moving averages now maintain correct position during pan and zoom
- Moving averages extend to the full width of visible candles
- Chart controls positioned with proper z-index

### Changed
- Removed app branding (MarketMind title and slogan) for cleaner interface
- Chart now occupies full viewport (100vw x 100vh)
- ChartCanvas border radius removed for edge-to-edge display

## [0.2.0] - 2025-11-14

### Added
- Complete canvas rendering system with CanvasManager
- Coordinate system utilities (price to Y, X to index conversions)
- Drawing utilities (rectangles, lines, text, candles, grid)
- ChartCanvas component with zoom and pan support
- CandlestickRenderer for rendering candlestick charts
- GridRenderer for rendering grid and price labels
- VolumeRenderer for rendering volume bars
- Sample data generator for testing
- Working chart visualization with candlesticks, grid, and volume
- Horizontal (time) and vertical (price) scales with formatting
- ResizeObserver for responsive canvas
- Hook-based architecture for all chart components
- Viewport culling for optimized rendering
- Mouse wheel zoom functionality
- Mouse drag pan functionality
- Price formatters with K/M/B notation
- AI types for future integration (AIProvider, AIMessage, AIAnalysisRequest)

### Fixed
- Canvas now fully responsive to container resize
- Eliminated flickering during chart interactions
- Time scale labels now display correctly
- Manager instance reuse to prevent unnecessary re-renders
- Optimized render cycle for smooth interactions
- Proper device pixel ratio handling for crisp rendering

### Configuration
- Vite 7.2.2 for build tooling
- React 19.2.0 with TypeScript
- Chakra UI 3.29.0 for UI components
- Electron 39.2.0 for desktop application
- Zustand 5.0.8 for state management
- Axios 1.13.2 for HTTP requests
- Date-fns 4.1.0 for date manipulation

### Development
- TypeScript 5.9.3 with strict mode enabled
- ESLint 9.39.1 with React and TypeScript plugins
- Prettier 3.6.2 for code formatting
- Git hooks to prevent direct pushes to main branch

## [0.1.0] - 2025-11-14

### Added
- Project initialization
- Repository structure and documentation
- Development environment setup

---

## Legend

- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` for vulnerability fixes
- `Configuration` for dependency version changes
- `Development` for development-only changes
