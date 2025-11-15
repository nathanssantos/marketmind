# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### In Progress
- Market API integration (Binance)
- AI integration (OpenAI GPT-4 Vision)
- Unit tests for hooks and utilities

## [0.4.0] - 2025-11-15

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
