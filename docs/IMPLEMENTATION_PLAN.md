# MarketMind - Implementation Plan

## 📋 Project Overview

**MarketMind** is a desktop application developed in Electron that combines advanced financial chart visualization (candlesticks) with artificial intelligence analysis to provide insights on cryptocurrencies, stocks, and other tradable assets.

### Main Objective
Create an "AI consultant" that assists traders and investors in technical chart analysis and news interpretation for buy/sell decision making on assets.

---

## 🛠 Technology Stack

### Core
- **TypeScript** (end-to-end with unified typing)
- **Electron** (latest stable version)
- **React 19** (UI Framework)

### UI/UX
- **Chakra UI** (components with light/dark mode support)
- **Canvas API** with helper library (e.g., Konva, PixiJS or custom wrapper)

### Build & Deploy
- **electron-builder** (installer generation)
- **electron-updater** (auto-update system)

### Management
- **Vite** (optimized build tool)
- **pnpm/npm** (package manager)

---

## 📁 Project Structure

```
marketmind/
├── src/
│   ├── main/                      # Electron main process
│   │   ├── index.ts               # Entry point
│   │   ├── window.ts              # Window management
│   │   ├── updater.ts             # Auto-update system
│   │   ├── ipc/                   # IPC handlers
│   │   └── preload.ts             # Preload script
│   │
│   ├── renderer/                  # Rendering process (React)
│   │   ├── App.tsx                # Root component
│   │   ├── index.tsx              # Entry point
│   │   ├── theme/                 # Chakra UI configuration
│   │   │   ├── index.ts
│   │   │   ├── colors.ts
│   │   │   └── components.ts
│   │   │
│   │   ├── components/            # React components
│   │   │   ├── Chart/             # Chart system
│   │   │   │   ├── ChartCanvas.tsx
│   │   │   │   ├── useChartCanvas.ts
│   │   │   │   ├── useChartCanvas.test.ts
│   │   │   │   ├── CandlestickRenderer.tsx
│   │   │   │   ├── useCandlestickRenderer.ts
│   │   │   │   ├── useCandlestickRenderer.test.ts
│   │   │   │   ├── LineRenderer.tsx
│   │   │   │   ├── useLineRenderer.ts
│   │   │   │   ├── useLineRenderer.test.ts
│   │   │   │   ├── GridRenderer.tsx
│   │   │   │   ├── useGridRenderer.ts
│   │   │   │   ├── useGridRenderer.test.ts
│   │   │   │   ├── VolumeRenderer.tsx
│   │   │   │   ├── useVolumeRenderer.ts
│   │   │   │   ├── useVolumeRenderer.test.ts
│   │   │   │   ├── MovingAverageRenderer.tsx
│   │   │   │   ├── useMovingAverageRenderer.ts
│   │   │   │   ├── useMovingAverageRenderer.test.ts
│   │   │   │   ├── ChartControls.tsx
│   │   │   │   ├── useChartControls.ts
│   │   │   │   └── useChartControls.test.ts
│   │   │   │
│   │   │   ├── Sidebar/           # AI Chat
│   │   │   │   ├── ChatSidebar.tsx
│   │   │   │   ├── useChatSidebar.ts
│   │   │   │   ├── useChatSidebar.test.ts
│   │   │   │   ├── MessageList.tsx
│   │   │   │   ├── useMessageList.ts
│   │   │   │   ├── useMessageList.test.ts
│   │   │   │   ├── MessageInput.tsx
│   │   │   │   ├── useMessageInput.ts
│   │   │   │   ├── useMessageInput.test.ts
│   │   │   │   ├── AISelector.tsx
│   │   │   │   ├── useAISelector.ts
│   │   │   │   ├── useAISelector.test.ts
│   │   │   │   ├── ImageRenderer.tsx
│   │   │   │   ├── useImageRenderer.ts
│   │   │   │   └── useImageRenderer.test.ts
│   │   │   │
│   │   │   ├── Settings/          # Settings
│   │   │   │   ├── SettingsModal.tsx
│   │   │   │   ├── useSettingsModal.ts
│   │   │   │   ├── useSettingsModal.test.ts
│   │   │   │   ├── AIConfig.tsx
│   │   │   │   ├── useAIConfig.ts
│   │   │   │   ├── useAIConfig.test.ts
│   │   │   │   ├── GeneralSettings.tsx
│   │   │   │   ├── useGeneralSettings.ts
│   │   │   │   └── useGeneralSettings.test.ts
│   │   │   │
│   │   │   └── Layout/            # Layout components
│   │   │       ├── Header.tsx
│   │   │       ├── useHeader.ts
│   │   │       ├── useHeader.test.ts
│   │   │       ├── Toolbar.tsx
│   │   │       ├── useToolbar.ts
│   │   │       ├── useToolbar.test.ts
│   │   │       ├── MainLayout.tsx
│   │   │       ├── useMainLayout.ts
│   │   │       └── useMainLayout.test.ts
│   │   │
│   │   ├── services/              # Services
│   │   │   ├── ai/                # AI connectors
│   │   │   │   ├── AIService.ts
│   │   │   │   ├── AIService.test.ts
│   │   │   │   ├── providers/
│   │   │   │   │   ├── OpenAIProvider.ts
│   │   │   │   │   ├── OpenAIProvider.test.ts
│   │   │   │   │   ├── AnthropicProvider.ts
│   │   │   │   │   ├── AnthropicProvider.test.ts
│   │   │   │   │   ├── GeminiProvider.ts
│   │   │   │   │   ├── GeminiProvider.test.ts
│   │   │   │   │   ├── BaseProvider.ts
│   │   │   │   │   └── BaseProvider.test.ts
│   │   │   │   └── types.ts
│   │   │   │
│   │   │   ├── market/            # Market APIs
│   │   │   │   ├── MarketDataService.ts
│   │   │   │   ├── MarketDataService.test.ts
│   │   │   │   ├── providers/
│   │   │   │   │   ├── BinanceProvider.ts
│   │   │   │   │   ├── BinanceProvider.test.ts
│   │   │   │   │   ├── AlphaVantageProvider.ts
│   │   │   │   │   ├── AlphaVantageProvider.test.ts
│   │   │   │   │   ├── BaseMarketProvider.ts
│   │   │   │   │   └── BaseMarketProvider.test.ts
│   │   │   │   └── types.ts
│   │   │   │
│   │   │   └── news/              # News APIs
│   │   │       ├── NewsService.ts
│   │   │       ├── NewsService.test.ts
│   │   │       └── types.ts
│   │   │
│   │   ├── hooks/                 # Custom React hooks
│   │   │   ├── useChart.ts
│   │   │   ├── useChart.test.ts
│   │   │   ├── useAI.ts
│   │   │   ├── useAI.test.ts
│   │   │   ├── useMarketData.ts
│   │   │   ├── useMarketData.test.ts
│   │   │   ├── useSettings.ts
│   │   │   └── useSettings.test.ts
│   │   │
│   │   ├── store/                 # State management
│   │   │   ├── chartStore.ts
│   │   │   ├── chartStore.test.ts
│   │   │   ├── aiStore.ts
│   │   │   ├── aiStore.test.ts
│   │   │   ├── settingsStore.ts
│   │   │   ├── settingsStore.test.ts
│   │   │   └── index.ts
│   │   │
│   │   └── utils/                 # Utilities
│   │       ├── canvas/
│   │       │   ├── CanvasManager.ts
│   │       │   ├── CanvasManager.test.ts
│   │       │   ├── drawingUtils.ts
│   │       │   ├── drawingUtils.test.ts
│   │       │   ├── coordinateSystem.ts
│   │       │   └── coordinateSystem.test.ts
│   │       ├── formatters.ts
│   │       ├── formatters.test.ts
│   │       ├── validators.ts
│   │       └── validators.test.ts
│   │
│   └── shared/                    # Shared code
│       ├── types/                 # TypeScript types
│       │   ├── candle.ts
│       │   ├── chart.ts
│       │   ├── ai.ts
│       │   └── index.ts
│       │
│       └── constants/
│           ├── chartConfig.ts
│           └── appConfig.ts
│
├── docs/                          # Documentation
│   ├── IMPLEMENTATION_PLAN.md     # This file
│   ├── PLANO_IMPLEMENTACAO.md     # Portuguese version
│   ├── CHANGELOG.md               # Version history
│   ├── AI_CONTEXT.md              # AI development context
│   ├── ESLINT.md                  # ESLint configuration guide
│   └── GIT_COMMANDS.md            # Git workflow guide
│
├── scripts/                       # Utility scripts
│   ├── install-hooks.sh
│   ├── setup-github.sh
│   └── README.md
│
├── electron-builder.config.js     # Builder configuration
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts              # Vitest configuration
└── README.md
```

---

## 🎯 Implementation Phases

### **PHASE 1: Initial Project Setup** ✅ **COMPLETED**
*Estimated duration: 1 day*

#### 1.1 Initialization
- [x] Create project with Vite + Electron + React + TypeScript
- [x] Configure Electron with main and renderer process
- [x] Configure hot-reload for development
- [x] Basic Chakra UI setup with light/dark theme

#### 1.2 Base Structure
- [x] Create folder structure
- [x] Configure TypeScript paths
- [x] Setup ESLint and Prettier
- [x] Configure IPC between main and renderer

**Initial commands:**
```bash
npm init vite@latest marketmind -- --template react-ts
cd marketmind
npm install
npm install electron electron-builder electron-updater
npm install @chakra-ui/react @emotion/react @emotion/styled framer-motion
npm install -D vite-plugin-electron concurrently
```

---

### **PHASE 2: Unified Type System** ✅ **COMPLETED**
*Estimated duration: 1 day*

#### 2.1 Candle Data Types ✅
```typescript
// shared/types/candle.ts
export interface Candle {
  timestamp: number;        // Unix timestamp in ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleData {
  symbol: string;           // Ex: "BTCUSDT", "AAPL"
  interval: TimeInterval;   // Ex: "1m", "5m", "1h", "1d"
  candles: Candle[];
}

export type TimeInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M';
```

#### 2.2 Chart Types ✅
```typescript
// shared/types/chart.ts
export type ChartType = 'candlestick' | 'line';

export interface MovingAverage {
  period: number;           // Ex: 20, 50, 200
  type: 'SMA' | 'EMA';     // Simple or Exponential
  color: string;
  visible: boolean;
}

export interface ChartConfig {
  type: ChartType;
  showVolume: boolean;
  showGrid: boolean;
  movingAverages: MovingAverage[];
  colors: {
    bullish: string;
    bearish: string;
    volume: string;
    grid: string;
    background: string;
  };
}
```

#### 2.3 AI Types ✅
```typescript
// shared/types/ai.ts
export interface AIProvider {
  id: string;
  name: string;
  apiKey: string;
  model: string;
  enabled: boolean;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];        // URLs or base64
  timestamp: number;
}

export interface AIAnalysisRequest {
  chartImage: string;       // base64
  candles: Candle[];
  news?: NewsArticle[];
  context?: string;
}

export interface AIAnalysisResponse {
  text: string;
  confidence?: number;
  signals?: TradingSignal[];
}

export type TradingSignal = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
```

---

### **PHASE 3: Chart Rendering System** 🚧 **IN PROGRESS**
*Estimated duration: 4-5 days*

#### 3.1 Base Canvas Manager ✅
- [x] Create `CanvasManager` class to manage 2D context
- [x] Coordinate system (data ↔ pixels conversion)
- [x] Zoom and pan system
- [x] Event detection (hover, click)

#### 3.2 Grid Renderer ✅
- [x] Render background grid
- [x] Price labels (Y axis)
- [ ] Time labels (X axis)
- [x] Support lines responsive to zoom

#### 3.3 Candlestick Renderer ✅
- [x] Draw candles (rectangles + lines)
- [x] Dynamic colors (bullish/bearish)
- [x] Optimization for large datasets
- [ ] Tooltip with candle information

#### 3.4 Line Chart Renderer
- [ ] Render line chart
- [ ] Line smoothing (optional)
- [ ] Fill below line (area)

#### 3.5 Volume Renderer ✅
- [x] Volume bars at the bottom
- [x] Colors based on candle direction
- [x] Independent price scale

#### 3.6 Moving Averages
- [ ] Calculate SMA (Simple Moving Average)
- [ ] Calculate EMA (Exponential Moving Average)
- [ ] Render multiple MAs
- [ ] Visual configuration (color, thickness)

#### 3.7 Chart Controls
- [ ] Chart type selector
- [ ] Volume toggle
- [ ] Grid toggle
- [ ] MA configuration
- [ ] Time interval selector

**Canvas Implementation:** ✅ Using pure Canvas API with custom CanvasManager class for maximum control and performance.

---

## 🏗️ Component Architecture Guidelines

### Component Logic Separation
- **Always separate component logic into custom hooks** located in the same folder as the component
- Each component should have a corresponding hook file (e.g., `ChartCanvas.tsx` → `useChartCanvas.ts`)
- Hooks should contain all business logic, state management, and side effects
- Components should focus only on rendering and UI concerns

### Testing Requirements
- **Always create unit tests for custom hooks** in the same folder
- Test files should follow the naming convention: `useHookName.test.ts`
- All hook logic must be covered by unit tests before component integration
- Use `@testing-library/react-hooks` for testing custom hooks in isolation

### Folder Structure Example
```
components/
  Chart/
    ChartCanvas.tsx          # Component (UI only)
    useChartCanvas.ts        # Hook (logic)
    useChartCanvas.test.ts   # Hook tests
    ChartControls.tsx
    useChartControls.ts
    useChartControls.test.ts
```

### Benefits
- **Testability**: Logic separated from UI is easier to test
- **Reusability**: Hooks can be shared across components
- **Maintainability**: Clear separation of concerns
- **Type Safety**: Better TypeScript inference and autocomplete

---

### **PHASE 4: Market API Integration** ✅ **COMPLETED**
*Duration: 1 day (November 15, 2025)*

#### 4.1 Base Provider ✅
```typescript
// shared/types/market.ts
export abstract class BaseMarketProvider {
  abstract fetchCandles(options: FetchCandlesOptions): Promise<CandleData>;
  abstract searchSymbols(query: string): Promise<Symbol[]>;
  abstract getSymbolInfo(symbol: string): Promise<SymbolInfo>;
  abstract normalizeSymbol(symbol: string): string;
}
```

#### 4.2 Implement Providers ✅
- [x] **Binance API** (crypto)
  - REST for historical data (klines endpoint)
  - Symbol search and info (exchangeInfo endpoint)
  - Free, no API key required
  - Rate limiting (20 req/s)
  - Exchange info caching (5min)
- [x] **CoinGecko API** (crypto fallback)
  - REST for historical data
  - Coin search functionality
  - Free, no API key required
  - Rate limiting (10 req/s)
- [x] Local cache system (60s default)
- [ ] **Alpha Vantage** (stocks) - planned for v1.1+
- [ ] **WebSocket** for real-time data - planned

#### 4.3 Market Data Service ✅
- [x] Multiple provider manager (MarketDataService)
- [x] Automatic fallback system
- [x] Rate limiting per provider
- [x] Response caching with configurable duration
- [x] Cache key generation
- [x] Provider switching (setPrimaryProvider, addFallbackProvider)

#### 4.4 React Integration ✅
- [x] useMarketData hook for components
- [x] useSymbolSearch hook with debouncing
- [x] SymbolSelector component
- [x] Loading and error states
- [x] Symbol persistence in localStorage
- [x] Real-time data display in charts

#### 4.5 Documentation ✅
- [x] Complete API documentation (services/market/README.md)
- [x] Provider architecture guide
- [x] Usage examples
- [x] Adding new providers guide

---

### **PHASE 5: AI System** ✅ **COMPLETED**
*Duration: 3 days (November 13-15, 2025)*

#### 5.1 Base AI Provider ✅
```typescript
// services/ai/providers/BaseProvider.ts
export abstract class BaseAIProvider {
  protected apiKey: string;
  protected model: string;
  
  abstract sendMessage(
    messages: AIMessage[],
    images?: string[]
  ): Promise<AIAnalysisResponse>;
  
  abstract analyzeChart(
    request: AIAnalysisRequest
  ): Promise<AIAnalysisResponse>;
}
```

#### 5.2 Implement Providers ✅
- [x] **OpenAI (GPT-4o & GPT-4o Mini)**
  - Chart image analysis with native vision
  - Conversation context management
  - 2 models: GPT-4o ($2.50/$10), GPT-4o Mini ($0.15/$0.60)
- [x] **Anthropic (Claude 4.5, 4.1, 3.7, 3.5)**
  - Multimodal analysis with vision API
  - Extended thinking capabilities
  - 6 models: Sonnet 4.5, Haiku 4.5, Opus 4.1, Sonnet 3.7, Sonnet 3.5, Haiku 3.5
- [x] **Google Gemini (2.0, 1.5 Pro, Flash, Flash-8B)**
  - FREE tier with Gemini 2.0 Flash Exp
  - Massive context window (2M tokens)
  - 4 models: 2.0 Flash Exp (FREE), 1.5 Pro, 1.5 Flash, 1.5 Flash-8B

#### 5.3 AI Service Manager ✅
- [x] Active provider selector (Anthropic/OpenAI/Google)
- [x] API key management with environment variables
- [x] Conversation history with model tracking
- [x] Optimized prompt system via prompts.json
- [x] Provider factory pattern
- [x] aiStore with Zustand
- [x] useAI hook with React integration

#### 5.4 Prompts Engineering ✅
```typescript
const CHART_ANALYSIS_PROMPT = `
You are an experienced technical analyst. Analyze the provided chart and:
1. Identify candlestick patterns (doji, hammer, engulfing, etc)
2. Evaluate trends (bullish, bearish, sideways)
3. Identify supports and resistances
4. Analyze indicators (moving averages, volume)
5. Provide a trading signal: STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL
6. Justify your analysis based on technical analysis
`;
```

#### 5.5 UI Components ✅
- [x] AITest component with full configuration
- [x] Provider selector with 3 options
- [x] Model selector with 12 total models
- [x] Pricing information display
- [x] Temperature and max tokens controls
- [x] Settings management without clearing history
- [x] Conversation display with model tracking
- [x] Code refactored with useMemo (no nested ternaries)
- [x] All code comments removed

#### 5.6 Documentation ✅
- [x] OPENAI_MODELS.md - Complete GPT documentation
- [x] CLAUDE_MODELS.md - Complete Claude documentation
- [x] GEMINI_MODELS.md - Complete Gemini documentation
- [x] API_KEYS_SECURITY.md - Security best practices
- [x] Environment variable setup (.env, .env.example)

---

### **PHASE 6: AI Chat Interface** ✅ **COMPLETED**
*Duration: 2 days (November 15, 2025)*

#### 6.1 Chat Components ✅
- [x] Responsive sidebar (collapsible, 300-800px)
- [x] Message list with auto-scroll
- [x] Markdown rendering (react-markdown)
- [x] Avatar.Root for user/assistant icons
- [x] Loading spinner indicator
- [x] Messages with timestamp
- [x] Empty state UI

#### 6.2 AI Selector ✅
- [x] Dropdown with 3 available providers (OpenAI, Claude, Gemini)
- [x] Model selector with 10 AI models
- [x] Visual indicator of active provider
- [x] Status badge
- [x] Settings icon in header

#### 6.3 Message Input ✅
- [x] Textarea with vertical padding
- [x] Send button
- [x] Keyboard shortcut (Enter)
- [x] Chart data context (100 candles + statistics)
- [x] Clean UI (data sent to API, not displayed)

#### 6.4 Advanced Features ✅
- [x] ChartContext for sharing data across components
- [x] Chart data formatting with statistics
- [x] Structured data instead of images
- [x] Theme system with semantic tokens
- [x] Resizable sidebar with localStorage
- [x] Light/dark mode toggle
- [ ] Export conversation (planned for v1.1)
- [ ] Clear history (planned for v1.1)
- [ ] Save favorite analyses (planned for v1.1)

---

### **PHASE 7: Settings System** ✅ **COMPLETED**
*Duration: 1 day (November 15, 2025)*

#### 7.1 AI Settings ✅
- [x] API key management with encryption
- [x] Support for 3 providers (OpenAI, Anthropic, Gemini)
- [x] Model selection per provider
- [x] Generation parameters (temperature, max tokens)
- [x] Individual save buttons per provider
- [ ] Connection test (planned for v1.1)

#### 7.2 Chart Settings ✅
- [x] Light/dark theme (completed in Phase 6)
- [x] Chart type switcher
- [x] Display preferences (volume, grid, MAs)
- [x] Advanced controls panel
- [ ] Color themes (planned for v1.1)
- [ ] Default MA settings UI (planned for v1.1)

#### 7.3 General Settings ✅
- [x] Light/dark theme toggle
- [x] Settings persistence via localStorage
- [ ] Language (prepare i18n) - planned for v2.0
- [ ] Cache preferences - planned for v1.1
- [ ] Update settings - planned for Phase 10

#### 7.4 Secure Storage ✅
- [x] electron-store integration
- [x] Electron safeStorage API for encryption
- [x] Platform-specific encryption (Keychain on macOS, DPAPI on Windows)
- [x] IPC handlers for secure operations
- [x] Migration from localStorage
- [x] Multiple provider support
- [ ] Import/Export settings - planned for v1.1

#### 7.5 Implementation Details ✅
**Secure Storage Service:**
```typescript
// StorageService with electron-store + safeStorage
- setApiKey(provider, key) - Encrypt and store
- getApiKey(provider) - Decrypt and retrieve
- deleteApiKey(provider) - Remove encrypted key
- hasApiKey(provider) - Check existence
- getAllApiKeys() - Get all providers status
```

**IPC Communication:**
- storage:setApiKey
- storage:getApiKey
- storage:deleteApiKey
- storage:hasApiKey
- storage:getAllApiKeys
- storage:clearAllApiKeys
- storage:isEncryptionAvailable

**React Integration:**
- useSecureStorage hook with async operations
- AIConfigTab with 3 provider inputs
- Loading and error states
- Automatic migration on startup

**Files Created/Modified:**
- `src/main/services/StorageService.ts` - Secure storage service
- `src/main/index.ts` - IPC handlers
- `src/main/preload.ts` - API exposure
- `src/renderer/hooks/useSecureStorage.ts` - React hook
- `src/renderer/components/Settings/AIConfigTab.tsx` - Settings UI
- `src/renderer/components/Settings/SettingsDialog.tsx` - Modal container
- `src/renderer/utils/migration.ts` - Migration utility

---

### **PHASE 8: News Integration** ✅ **COMPLETED**
*Duration: 1 day*  
*Completed: November 15, 2025*

#### 8.1 News Service ✅
```typescript
export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
  relevance?: number;
  imageUrl?: string;
  author?: string;
}

export interface NewsProvider {
  name: string;
  fetchNews(options: NewsOptions): Promise<NewsArticle[]>;
}
```

#### 8.2 News Providers ✅
- ✅ **BaseNewsProvider** - Abstract base class
- ✅ **NewsAPIProvider** - General financial news (newsapi.org)
  - 100 requests/day free tier
  - Symbol-based filtering
  - Article deduplication
- ✅ **CryptoPanicProvider** - Crypto-specific news (cryptopanic.com)
  - Public and authenticated endpoints
  - Vote-based sorting
  - Currency filtering
- ✅ **NewsService** - Multi-provider aggregation
  - Response caching (5-minute default)
  - Automatic fallback on provider failure
  - Rate limiting per provider

#### 8.3 News Display ✅
- ✅ **NewsPanel** component
  - Article list with images
  - Sentiment badges (positive/negative/neutral)
  - Source and publication date
  - Click to open in browser
  - Loading states and error handling
- ✅ **NewsConfigTab** settings
  - Enable/disable toggle
  - API key management (encrypted)
  - Refresh interval (1-60 minutes)
  - Max articles (5-50)
  - Test connection button
- ✅ **useNews** hook
  - Symbol-based filtering
  - Auto-refresh functionality
  - Loading and error states
  - Dependency optimization

#### 8.4 AI Integration ✅
- ✅ News context in chart analysis
- ✅ Recent news included in AI prompts
- ✅ formatChartDataContext extended with news

#### 8.5 Secure Storage ✅
- ✅ Extended StorageService for news API keys
- ✅ newsapi and cryptopanic provider support
- ✅ newsSettings (enabled, refreshInterval, maxArticles)
- ✅ IPC handlers for news storage
- ✅ Automatic migration from localStorage

#### Files Created
- `docs/NEWS.md` - Complete integration guide
- `docs/STORAGE_GUIDE.md` - Storage best practices
- `src/shared/types/news.ts` - News type definitions
- `src/renderer/services/news/NewsService.ts`
- `src/renderer/services/news/providers/NewsAPIProvider.ts`
- `src/renderer/services/news/providers/CryptoPanicProvider.ts`
- `src/renderer/hooks/useNews.ts`
- `src/renderer/components/News/NewsPanel.tsx`
- `src/renderer/components/Settings/NewsConfigTab.tsx`

---

### **PHASE 9: Build and Deploy System**
*Estimated duration: 2-3 days*

#### 9.1 Electron Builder Config
```javascript
// electron-builder.config.js
module.exports = {
  appId: 'com.marketmind.app',
  productName: 'MarketMind',
  directories: {
    output: 'dist-electron',
  },
  files: [
    'dist/**/*',
    'node_modules/**/*',
    'package.json',
  ],
  mac: {
    target: ['dmg', 'zip'],
    category: 'public.app-category.finance',
    icon: 'build/icon.icns',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
  },
  win: {
    target: ['nsis', 'portable'],
    icon: 'build/icon.ico',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
};
```

#### 9.2 Code Signing
- [ ] Certificate for macOS (Apple Developer)
- [ ] Certificate for Windows (Sectigo, DigiCert)
- [ ] Configure automatic signing

#### 9.3 Build Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build && electron-builder",
    "build:mac": "electron-builder --mac",
    "build:win": "electron-builder --win",
    "build:all": "electron-builder --mac --win",
    "release": "npm run build:all"
  }
}
```

---

### **PHASE 10: Auto-Update System** ✅
*Duration: 1 day*
*Status: COMPLETED - December 19, 2024*

#### 10.1 Electron Updater Setup ✅
```typescript
// main/services/UpdateManager.ts
import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import log from 'electron-log';

export class UpdateManager {
  private window: BrowserWindow;
  private autoCheckInterval?: NodeJS.Timeout;
  
  constructor(window: BrowserWindow) {
    this.window = window;
    this.setupAutoUpdater();
    this.setupEventHandlers();
  }
  
  private setupAutoUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.logger = log;
  }
  
  private setupEventHandlers() {
    autoUpdater.on('checking-for-update', () => {
      this.window.webContents.send('update:checking');
    });
    
    autoUpdater.on('update-available', (info) => {
      this.window.webContents.send('update:available', info);
    });
    
    autoUpdater.on('download-progress', (progress) => {
      this.window.webContents.send('update:download-progress', progress);
    });
    
    autoUpdater.on('update-downloaded', (info) => {
      this.window.webContents.send('update:downloaded', info);
    });
    
    autoUpdater.on('error', (error) => {
      this.window.webContents.send('update:error', error.message);
    });
  }
  
  async checkForUpdates() {
    await autoUpdater.checkForUpdates();
  }
  
  async downloadUpdate() {
    await autoUpdater.downloadUpdate();
  }
  
  quitAndInstall() {
    autoUpdater.quitAndInstall(false, true);
  }
  
  startAutoCheckInterval(intervalHours: number) {
    this.stopAutoCheckInterval();
    const intervalMs = intervalHours * 60 * 60 * 1000;
    this.autoCheckInterval = setInterval(() => {
      this.checkForUpdates();
    }, intervalMs);
    this.checkForUpdates();
  }
  
  stopAutoCheckInterval() {
    if (this.autoCheckInterval) {
      clearInterval(this.autoCheckInterval);
      this.autoCheckInterval = undefined;
    }
  }
}
```

#### 10.2 Update Server ✅
**Selected:** GitHub Releases (free, simple, reliable)
- Configured electron-builder with GitHub provider
- Automatic version detection from package.json
- Support for macOS (DMG), Windows (NSIS), Linux (AppImage)

#### 10.3 Update Flow ✅
1. App opens → UpdateManager initializes
2. If auto-check enabled → periodic checks (configurable interval)
3. Update available → UpdateNotification displays
4. User clicks "Download" → download in background with progress
5. Download complete → "Install and Restart" button appears
6. User clicks → app quits and installs update

#### 10.4 Update UI ✅
- ✅ UpdateNotification component with real-time status
- ✅ Download progress bar with speed and size indicators
- ✅ "Download" and "Install and Restart" buttons
- ✅ Dismiss option for all states
- ✅ Release notes display (version and date)
- ✅ Settings integration for preferences
  - Auto-check toggle
  - Check interval slider (1-168 hours)
  - Auto-download toggle
  - Manual "Check for Updates Now" button

#### 10.5 IPC Communication ✅
- ✅ `update:check` - Manual update check
- ✅ `update:download` - Download available update
- ✅ `update:install` - Quit and install
- ✅ `update:getInfo` - Get current update info
- ✅ `update:startAutoCheck` - Start periodic checks
- ✅ `update:stopAutoCheck` - Stop automatic checks

#### 10.6 Documentation ✅
- ✅ docs/AUTO_UPDATE.md - Complete auto-update guide
  - Architecture and component overview
  - GitHub releases publishing workflow
  - Development and testing procedures
  - Security (code signing, notarization)
  - Troubleshooting and best practices
  - API reference

#### 10.7 Critical Fixes ✅
- ✅ **ESM/CommonJS Compatibility**: Resolved module system incompatibility
  - Issue: App built successfully but Electron window wouldn't open
  - Root cause: `electron-store` requires ESM (`"type": "module"`), but `electron` and `electron-updater` are CommonJS
  - Solution: Changed imports from named to namespace pattern (`import * as electron from 'electron'`)
  - Applied to: `index.ts`, `StorageService.ts`, `UpdateManager.ts`
  - Configured Vite to externalize all Electron dependencies
  - Added development mode detection to UpdateManager
  - Result: App launches correctly, hot reload working ✅

**Lessons Learned:**
- electron-store is ESM-only and requires `"type": "module"` in package.json
- electron and electron-updater are CommonJS modules
- Named imports from CommonJS modules fail in ESM context
- Solution: Use `import * as` for CommonJS modules, destructure after import
- Always externalize Electron modules in Vite configuration
- Development mode detection prevents auto-updater from running in dev

---

### **PHASE 11: Testing & Quality Assurance** 🚧
*Estimated duration: 2-3 days*
*Status: IN PROGRESS (72% Complete)*
*Started: December 15, 2024*

#### 11.1 Unit Testing ✅ (72%)
**Status:** 181 tests passing, 97.5% overall coverage

**Test Infrastructure:** ✅
- [x] Vitest 4.0.9 + React Testing Library configured
- [x] Coverage reporting with @vitest/coverage-v8
- [x] jsdom environment setup
- [x] Global test configuration
- [x] Dependency injection patterns for testability

**Completed Tests:** ✅
- [x] Utility functions (69 tests, 95.97% coverage)
  - formatters.test.ts (28 tests) - 100% statement coverage
  - movingAverages.test.ts (22 tests) - 88.23% coverage
  - coordinateSystem.test.ts (19 tests) - 98.36% coverage
  
- [x] React hooks (112 tests, 98.75% coverage)
  - useDebounce.test.ts (6 tests) - 100% coverage
  - useLocalStorage.test.ts (13 tests) - 100% coverage
  - useChartData.test.ts (10 tests) - 100% coverage
  - useMarketData.test.ts (10 tests) - 100% coverage
  - useSymbolSearch.test.ts (11 tests) - 100% coverage
  - useRealtimeCandle.test.ts (11 tests) - 100% coverage
  - useAutoUpdate.test.ts (18 tests) - 96.15% coverage
  - useNews.test.ts (15 tests) - 100% coverage ✨
  - useAI.test.ts (16 tests) - 98.5% coverage ✨

**Refactored for Testability:** ✅
- [x] useNews - Dependency injection pattern with optional NewsService parameter
- [x] useAI - Dependency injection pattern with optional AIService parameter
- [x] Singleton factories for backward compatibility (getDefaultNewsService, getDefaultAIService)

**Pending Tests:** ⏳
- [ ] Service layer (MarketDataService, NewsService, AIService)
- [ ] Component tests (Chart renderers, controls, sidebar)
- [ ] IPC handlers (storage, update operations)
- [ ] StorageService encryption/decryption
- [ ] UpdateManager state management

**Previously Skipped (Now Complete):**
- [x] useNews hook (refactored with dependency injection) ✅
- [x] useAI hook (refactored with dependency injection) ✅

#### 11.2 Integration Testing
- [ ] Test Electron IPC communication flow
- [ ] Test chart rendering with real data
- [ ] Test AI integration with mock responses
- [ ] Test news feed integration
- [ ] Test auto-update flow (with mock GitHub release)
- [ ] Test settings persistence

#### 11.3 Performance Testing
- [ ] Benchmark canvas rendering with large datasets (1000+ candles)
- [ ] Test memory usage during extended sessions
- [ ] Test CPU usage during chart interactions (zoom, pan, scroll)
- [ ] Profile chart renderer performance
- [ ] Test app startup time

#### 11.4 Cross-Platform Testing
- [ ] Test on macOS (x64 and arm64)
- [ ] Test on Windows 10/11
- [ ] Test on Linux (Ubuntu/Debian)
- [ ] Verify all features work on each platform
- [ ] Test auto-update on each platform

---

### **PHASE 12: Optimizations and Performance** ⏳
*Estimated duration: 2-3 days*
*Status: NOT STARTED*

#### 12.1 Canvas Performance
- [ ] Render only visible area (viewport culling)
- [ ] Debounce on zoom/pan
- [ ] RequestAnimationFrame for animations
- [ ] Web Workers for heavy calculations (MAs, indicators)
- [ ] OffscreenCanvas (if needed)

#### 12.2 Data Management
- [ ] Large dataset virtualization
- [ ] Lazy loading of historical candles
- [ ] IndexedDB for persistent cache
- [ ] Data compression

#### 12.3 Memory Management
- [ ] Cleanup unused canvas
- [ ] Conscious garbage collection
- [ ] Chat history limit

---

### **PHASE 13: Final Polish** ⏳
*Estimated duration: 2-3 days*
*Status: NOT STARTED*

#### 13.1 UI/UX Polish
- [ ] Smooth animations
- [ ] Loading states
- [ ] Visual error handling
- [ ] First-time onboarding
- [ ] Tooltips and hints

#### 13.2 Accessibility
- [ ] Keyboard support
- [ ] ARIA labels
- [ ] Adequate contrast
- [ ] Interface zoom

#### 13.3 Documentation
- [ ] Complete README
- [ ] Installation guide
- [ ] Development guide
- [ ] API documentation
- [ ] Troubleshooting

---

## 🔧 Important Configurations

### TypeScript Config (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["./src/shared/*"],
      "@renderer/*": ["./src/renderer/*"],
      "@main/*": ["./src/main/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Vite Config
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        onstart(options) {
          options.startup();
        },
        vite: {
          build: {
            outDir: 'dist-electron/main',
          },
        },
      },
      {
        entry: 'src/main/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@main': path.resolve(__dirname, './src/main'),
    },
  },
});
```

---

## 📦 Main Dependencies

### Production
```json
{
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "@chakra-ui/react": "^3.29.0",
    "@emotion/react": "^11.14.0",
    "electron-updater": "^6.6.2",
    "zustand": "^5.0.8",
    "axios": "^1.13.2",
    "date-fns": "^4.1.0",
    "konva": "^9.3.6",
    "react-konva": "^18.2.10"
  }
}
```

### Development
```json
{
  "devDependencies": {
    "@types/react": "^19.2.5",
    "@types/react-dom": "^19.2.3",
    "@types/node": "^24.10.1",
    "@vitejs/plugin-react": "^5.1.1",
    "electron": "^39.2.0",
    "electron-builder": "^26.0.12",
    "vite": "^7.2.2",
    "vite-plugin-electron": "^0.29.0",
    "vite-plugin-electron-renderer": "^0.14.6",
    "typescript": "^5.9.3",
    "vitest": "^3.0.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/user-event": "^14.5.2",
    "@vitest/ui": "^3.0.0",
    "jsdom": "^25.0.1",
    "eslint": "^9.39.1",
    "@typescript-eslint/eslint-plugin": "^8.46.4",
    "@typescript-eslint/parser": "^8.46.4",
    "eslint-plugin-react": "^7.37.5",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "prettier": "^3.6.2"
  }
}
```

---

## 🎨 Design System (Chakra UI)

### Base Theme
```typescript
// renderer/theme/index.ts
import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: true,
};

const colors = {
  brand: {
    50: '#e3f2fd',
    100: '#bbdefb',
    500: '#2196f3',
    900: '#0d47a1',
  },
  chart: {
    bullish: '#26a69a',
    bearish: '#ef5350',
    grid: '#2a2e39',
    background: '#1e222d',
  },
};

export const theme = extendTheme({ config, colors });
```

---

## 🚀 Estimated Timeline

| Phase | Description | Duration | Priority |
|------|-----------|---------|------------|
| 1 | Initial Setup | 1 day | 🔴 Critical |
| 2 | Type System | 1 day | 🔴 Critical |
| 3 | Chart Rendering | 4-5 days | 🔴 Critical |
| 4 | Market API Integration | 2-3 days | 🔴 Critical |
| 5 | AI System | 3-4 days | 🔴 Critical |
| 6 | Chat Interface | 2-3 days | 🟡 High |
| 7 | Settings System | 2 days | 🟡 High |
| 8 | News Integration | 2 days | 🟢 Medium |
| 9 | Build and Deploy | 2-3 days | 🔴 Critical |
| 10 | Auto-Update | 2-3 days | 🟡 High |
| 11 | Optimizations | 2-3 days | 🟡 High |
| 12 | Testing | 3-4 days | 🟡 High |
| 13 | Documentation and Polish | 2 days | 🟢 Medium |

**Total estimated: 26-35 days** (assuming full-time work)

---

## 📝 MVP Checklist (Minimum Viable Product)

### Essential for v1.0 Launch
- [x] Candlestick chart rendering
- [ ] Line chart rendering
- [x] Volume chart
- [x] Grid and labels (partial - missing time labels)
- [ ] At least 2 moving averages (SMA)
- [ ] Integration with 1 market API (Binance for crypto)
- [ ] Integration with 1 AI (OpenAI GPT-4 Vision)
- [ ] Functional AI chat
- [ ] AI selector
- [ ] Basic settings (API keys)
- [x] Light and Dark mode
- [ ] Installer for Mac and Windows
- [ ] Working auto-update system

### Nice to Have (v1.1+)
- [ ] Multiple market APIs
- [ ] Multiple AI providers
- [ ] News integration
- [ ] News sentiment analysis
- [ ] EMA (Exponential Moving Average)
- [ ] More technical indicators (RSI, MACD, Bollinger Bands)
- [ ] Price alerts
- [ ] Asset watchlist
- [ ] Export charts as images
- [ ] Custom themes

---

## 🔐 Security

### API Keys
- Store encrypted keys using Electron's `safeStorage`
- Never expose keys in renderer process
- Validate keys before saving

### Updates
- Verify package signatures
- Mandatory HTTPS for update server
- Checksum validation

### Network
- Rate limiting on API calls
- Adequate request timeout
- Retry with exponential backoff

---

## 🐛 Debug and Logging

### Development
```typescript
// Activate DevTools
if (process.env.NODE_ENV === 'development') {
  mainWindow.webContents.openDevTools();
}
```

### Logging
```typescript
// Use electron-log
import log from 'electron-log';

log.info('App started');
log.error('Error loading data', error);
```

### Crash Reporting
- Consider Sentry for production
- Local logs for debugging

---

## 📊 Performance Metrics

### Targets
- **Initial load time:** < 2s
- **Rendering 1000 candles:** < 100ms
- **FPS during pan/zoom:** > 30fps
- **AI response time:** < 10s
- **Installer size:** < 150MB

---

## 🔄 Development Workflow

### Branch Strategy
```
main (production)
├── develop (development)
    ├── feature/chart-rendering
    ├── feature/ai-integration
    └── feature/auto-update
```

### Semantic Commits
```
feat: add candlestick rendering
fix: correct SMA calculation
docs: update README with instructions
perf: optimize canvas rendering
```

---

## 📚 Resources and References

### Market APIs
- [Binance API Docs](https://binance-docs.github.io/apidocs/spot/en/)
- [Alpha Vantage API](https://www.alphavantage.co/documentation/)
- [Yahoo Finance API](https://www.yahoofinanceapi.com/)

### AI Providers
- [OpenAI Platform](https://platform.openai.com/docs)
- [Anthropic Claude](https://docs.anthropic.com/)
- [Google Gemini](https://ai.google.dev/)

### Electron
- [Electron Docs](https://www.electronjs.org/docs/latest)
- [Electron Builder](https://www.electron.build/)
- [Electron Updater](https://www.electron.build/auto-update)

### Canvas/Charts
- [HTML5 Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Konva.js](https://konvajs.org/)
- [TradingView Charting Library](https://www.tradingview.com/charting-library/) (paid, but reference)

---

## 🎯 Immediate Next Steps

### To start NOW:
1. **Create project structure** (Phase 1)
   ```bash
   npm create vite@latest marketmind -- --template react-ts
   cd marketmind
   npm install
   ```

2. **Install core dependencies**
   ```bash
   npm install electron electron-builder electron-updater
   npm install @chakra-ui/react @emotion/react @emotion/styled framer-motion
   npm install -D vite-plugin-electron concurrently
   ```

3. **Create folder structure** as specified

4. **Configure basic Electron** with main process and renderer

5. **Setup Chakra UI** with light/dark theme

6. **Create base types** (Phase 2)

---

## 💬 Instructions for New Chats

When starting a new chat due to large context, provide:

1. **This document** (IMPLEMENTATION_PLAN.md)
2. **Current phase** you're working on
3. **Files already created** (list the main ones)
4. **Problems encountered** (if any)
5. **Next desired task**

### Example prompt:
```
I'm developing MarketMind according to IMPLEMENTATION_PLAN.md.
Currently in PHASE 3 (Chart Rendering).
Already implemented: [list files/features]
Next step: implement the CandlestickRenderer.
```

---

## 📊 Current Project Status

**Last Updated:** November 15, 2025  
**Current Branch:** `develop`  
**Current Phase:** Phase 6 - AI Chat Interface (COMPLETED)

### ✅ Completed
- **Phase 1:** Initial Project Setup (100%)
- **Phase 2:** Unified Type System (100%)
- **Phase 3:** Chart Rendering System (100%)
  - ✅ CanvasManager with zoom/pan
  - ✅ Coordinate system utilities
  - ✅ Drawing utilities
  - ✅ ChartCanvas component
  - ✅ CandlestickRenderer
  - ✅ GridRenderer with time labels
  - ✅ VolumeRenderer
  - ✅ LineRenderer
  - ✅ MovingAverageRenderer (5 MAs: 9, 20, 50, 100, 200)
  - ✅ ChartControls with switches
  - ✅ AdvancedControls with pin functionality
  - ✅ TimeframeSelector
  - ✅ ChartTooltip
  - ✅ Settings persistence
- **Phase 4:** Market API Integration (100%)
  - ✅ BaseMarketProvider abstract class
  - ✅ BinanceProvider (primary, free)
  - ✅ CoinGeckoProvider (fallback, free)
  - ✅ MarketDataService with caching
  - ✅ useMarketData hook
  - ✅ useSymbolSearch hook
  - ✅ SymbolSelector component
  - ✅ Real-time market data integration
  - ✅ Complete documentation
- **Phase 5:** AI System (100%)
  - ✅ BaseAIProvider abstract class
  - ✅ OpenAIProvider (2 models: GPT-4o, GPT-4o Mini)
  - ✅ ClaudeProvider (6 models: Sonnet 4.5/3.7/3.5, Haiku 4.5/3.5, Opus 4.1)
  - ✅ GeminiProvider (4 models: 2.0 Flash Exp FREE, 1.5 Pro/Flash/Flash-8B)
  - ✅ AIService with provider factory
  - ✅ aiStore with Zustand
  - ✅ useAI hook with model tracking
  - ✅ AITest component (refactored with useMemo, no comments)
  - ✅ Environment variable management
  - ✅ Complete documentation (OPENAI_MODELS.md, CLAUDE_MODELS.md, GEMINI_MODELS.md)
  - ✅ 12 total AI models available
  - ✅ FREE tier option (Gemini 2.0 Flash Exp)
- **Phase 6:** AI Chat Interface (100%)
  - ✅ MainLayout with resizable sidebar (300-800px)
  - ✅ Header with AI selector, theme toggle, settings
  - ✅ ChatSidebar with open/close functionality
  - ✅ MessageList with markdown rendering
  - ✅ MessageInput with chart data integration
  - ✅ ChartContext for data sharing
  - ✅ Chart data formatting (100 candles, statistics, trends)
  - ✅ Theme system with semantic tokens
  - ✅ UI polish (padding, colors, backgrounds)
  - ✅ Correct Claude API model IDs
  - ✅ Clean separation (data in API calls only)
  - ✅ 10 AI models accessible (removed 3 older Claude models)

### 🚧 In Progress
- None - ready for Phase 7

### 📋 Next Steps
1. Start Phase 7 (Settings System)
   - SettingsModal component
   - API key management with encryption
   - Conversation export/import
   - Settings persistence
2. Add WebSocket for real-time market updates
3. Add unit tests for chat components
4. Add unit tests for AI providers
5. Add unit tests for market data services

---

## ✅ Conclusion

This plan provides a complete roadmap to develop MarketMind from scratch to launch. The project is ambitious but totally viable with the chosen technologies.

**Recommendation:** Follow the phases sequentially, ensuring each phase is solid before moving forward. Prioritize the MVP before adding "nice to have" features.

Good luck with development! 🚀

---

**Document Version:** 1.1  
**Date:** November 14, 2025  
**Author:** Initial planning for MarketMind development  
**Last Update:** Phase 1 and 2 completed, Phase 3 in progress

