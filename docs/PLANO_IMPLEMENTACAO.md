# MarketMind - Plano de Implementação

## 📋 Visão Geral do Projeto

**MarketMind** é uma aplicação desktop desenvolvida em Electron que combina visualização avançada de gráficos financeiros (candlesticks) com análise de inteligência artificial para fornecer insights sobre criptomoedas, ações e outros ativos negociáveis.

### Objetivo Principal
Criar um "consultor AI" que auxilia traders e investidores na análise técnica de gráficos e interpretação de notícias para tomada de decisão de compra/venda de ativos.

---

## 🛠 Stack Tecnológica

### Core
- **TypeScript** (end-to-end com tipagem unificada)
- **Electron** (última versão estável)
- **React 18+** (UI Framework)

### UI/UX
- **Chakra UI** (componentes com suporte a light/dark mode)
- **Canvas API** com biblioteca auxiliar (ex: Konva, PixiJS ou custom wrapper)

### Build & Deploy
- **electron-builder** (geração de instaladores)
- **electron-updater** (sistema de auto-update)

### Gerenciamento
- **Vite** (build tool otimizado)
- **pnpm/npm** (gerenciador de pacotes)

---

## 📁 Estrutura do Projeto

```
marketmind/
├── src/
│   ├── main/                      # Processo principal do Electron
│   │   ├── index.ts               # Entry point
│   │   ├── window.ts              # Gerenciamento de janelas
│   │   ├── updater.ts             # Sistema de auto-update
│   │   ├── ipc/                   # IPC handlers
│   │   └── preload.ts             # Preload script
│   │
│   ├── renderer/                  # Processo de renderização (React)
│   │   ├── App.tsx                # Componente raiz
│   │   ├── index.tsx              # Entry point
│   │   ├── theme/                 # Configuração Chakra UI
│   │   │   ├── index.ts
│   │   │   ├── colors.ts
│   │   │   └── components.ts
│   │   │
│   │   ├── components/            # Componentes React
│   │   │   ├── Chart/             # Sistema de gráficos
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
│   │   │   ├── Sidebar/           # Chat com AI
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
│   │   │   ├── Settings/          # Configurações
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
│   │   ├── services/              # Serviços
│   │   │   ├── ai/                # Conectores de AI
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
│   │   │   ├── market/            # APIs de mercado
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
│   │   │   └── news/              # APIs de notícias
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
│   │   └── utils/                 # Utilitários
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
│   └── shared/                    # Código compartilhado
│       ├── types/                 # Tipos TypeScript
│       │   ├── candle.ts
│       │   ├── chart.ts
│       │   ├── ai.ts
│       │   └── index.ts
│       │
│       └── constants/
│           ├── chartConfig.ts
│           └── appConfig.ts
│
├── docs/                          # Documentação
│   ├── IMPLEMENTATION_PLAN.md     # Plano em inglês
│   ├── PLANO_IMPLEMENTACAO.md     # Este arquivo
│   ├── CHANGELOG.md               # Histórico de versões
│   ├── AI_CONTEXT.md              # Contexto para desenvolvimento com AI
│   ├── ESLINT.md                  # Guia de configuração ESLint
│   └── GIT_COMMANDS.md            # Guia de workflow Git
│
├── scripts/                       # Scripts utilitários
│   ├── install-hooks.sh
│   ├── setup-github.sh
│   └── README.md
│
├── electron-builder.config.js     # Configuração do builder
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts              # Configuração do Vitest
└── README.md
```
├── vite.config.ts
└── README.md
```

---

## 🎯 Fases de Implementação

### **FASE 1: Setup Inicial do Projeto** 
*Duração estimada: 1 dia*

#### 1.1 Inicialização
- [ ] Criar projeto com Vite + Electron + React + TypeScript
- [ ] Configurar Electron com processo main e renderer
- [ ] Configurar hot-reload para desenvolvimento
- [ ] Setup básico do Chakra UI com tema light/dark

#### 1.2 Estrutura Base
- [ ] Criar estrutura de pastas
- [ ] Configurar TypeScript paths
- [ ] Setup de ESLint e Prettier
- [ ] Configurar IPC entre main e renderer

**Comandos iniciais:**
```bash
npm init vite@latest marketmind -- --template react-ts
cd marketmind
npm install
npm install electron electron-builder electron-updater
npm install @chakra-ui/react @emotion/react @emotion/styled framer-motion
npm install -D vite-plugin-electron concurrently
```

---

### **FASE 2: Sistema de Tipos Unificado**
*Duração estimada: 1 dia*

#### 2.1 Tipos de Dados de Candles
```typescript
// shared/types/candle.ts
export interface Candle {
  timestamp: number;        // Unix timestamp em ms
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

#### 2.2 Tipos de Chart
```typescript
// shared/types/chart.ts
export type ChartType = 'candlestick' | 'line';

export interface MovingAverage {
  period: number;           // Ex: 20, 50, 200
  type: 'SMA' | 'EMA';     // Simple ou Exponencial
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

#### 2.3 Tipos de AI
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
  images?: string[];        // URLs ou base64
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

### **FASE 3: Sistema de Renderização de Gráficos**
*Duração estimada: 4-5 dias*

#### 3.1 Canvas Manager Base
- [ ] Criar classe `CanvasManager` para gerenciar contexto 2D
- [ ] Sistema de coordenadas (conversão data ↔ pixels)
- [ ] Sistema de zoom e pan
- [ ] Detecção de eventos (hover, click)

#### 3.2 Grid Renderer
- [ ] Renderizar grid de fundo
- [ ] Labels de preço (eixo Y)
- [ ] Labels de tempo (eixo X)
- [ ] Linhas de suporte responsivas ao zoom

#### 3.3 Candlestick Renderer
- [ ] Desenhar candles (retângulos + linhas)
- [ ] Cores dinâmicas (alta/baixa)
- [ ] Otimização para grandes datasets
- [ ] Tooltip com informações do candle

#### 3.4 Line Chart Renderer
- [ ] Renderizar gráfico de linha
- [ ] Suavização de linha (opcional)
- [ ] Preenchimento abaixo da linha (área)

#### 3.5 Volume Renderer
- [ ] Barras de volume na parte inferior
- [ ] Cores baseadas em direção do candle
- [ ] Escala independente do preço

#### 3.6 Moving Averages
- [ ] Cálculo de SMA (Simple Moving Average)
- [ ] Cálculo de EMA (Exponential Moving Average)
- [ ] Renderização de múltiplas MAs
- [ ] Configuração visual (cor, espessura)

#### 3.7 Controles do Chart
- [ ] Seletor de tipo de gráfico
- [ ] Toggle de volume
- [ ] Toggle de grid
- [ ] Configuração de MAs
- [ ] Seletor de intervalo de tempo

**Bibliotecas recomendadas para Canvas:**
- **Opção 1:** Canvas API puro (máximo controle)
- **Opção 2:** Konva.js (facilita gestão de objetos 2D)
- **Opção 3:** PixiJS (alta performance, mas mais complexo)

**Recomendação:** Começar com Canvas API puro + classe helper customizada para máximo controle e performance.

---

## 🏗️ Diretrizes de Arquitetura de Componentes

### Separação da Lógica de Componentes
- **Sempre separe a lógica dos componentes em hooks customizados** localizados na mesma pasta do componente
- Cada componente deve ter um arquivo de hook correspondente (ex: `ChartCanvas.tsx` → `useChartCanvas.ts`)
- Hooks devem conter toda a lógica de negócio, gerenciamento de estado e efeitos colaterais
- Componentes devem focar apenas em renderização e questões de UI

### Requisitos de Testes
- **Sempre crie testes unitários para hooks customizados** na mesma pasta
- Arquivos de teste devem seguir a convenção: `useHookName.test.ts`
- Toda a lógica dos hooks deve ser coberta por testes unitários antes da integração com componentes
- Use `@testing-library/react-hooks` para testar hooks customizados de forma isolada

### Exemplo de Estrutura de Pastas
```
components/
  Chart/
    ChartCanvas.tsx          # Componente (apenas UI)
    useChartCanvas.ts        # Hook (lógica)
    useChartCanvas.test.ts   # Testes do hook
    ChartControls.tsx
    useChartControls.ts
    useChartControls.test.ts
```

### Benefícios
- **Testabilidade**: Lógica separada da UI é mais fácil de testar
- **Reusabilidade**: Hooks podem ser compartilhados entre componentes
- **Manutenibilidade**: Separação clara de responsabilidades
- **Type Safety**: Melhor inferência TypeScript e autocomplete

---

### **FASE 4: Integração com APIs de Mercado**
*Duração estimada: 2-3 dias*

#### 4.1 Base Provider
```typescript
// services/market/providers/BaseMarketProvider.ts
export abstract class BaseMarketProvider {
  abstract fetchCandles(
    symbol: string,
    interval: TimeInterval,
    limit?: number
  ): Promise<CandleData>;
  
  abstract searchSymbols(query: string): Promise<Symbol[]>;
  
  abstract getSymbolInfo(symbol: string): Promise<SymbolInfo>;
}
```

#### 4.2 Implementar Providers
- [ ] **Binance API** (crypto)
  - WebSocket para dados real-time
  - REST para dados históricos
- [ ] **Alpha Vantage** (ações)
  - Dados históricos
  - Informações fundamentalistas
- [ ] Sistema de cache local

#### 4.3 Market Data Service
- [ ] Gerenciador de múltiplos providers
- [ ] Sistema de fallback
- [ ] Rate limiting
- [ ] Cache de dados

---

### **FASE 5: Sistema de AI**
*Duração estimada: 3-4 dias*

#### 5.1 Base AI Provider
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

#### 5.2 Implementar Providers
- [ ] **OpenAI (GPT-4 Vision)**
  - Análise de imagens de gráficos
  - Contexto de conversação
- [ ] **Anthropic (Claude 3)**
  - Análise multimodal
  - Raciocínio sobre dados
- [ ] **Google Gemini**
  - Alternativa com visão

#### 5.3 AI Service Manager
- [ ] Seletor de provider ativo
- [ ] Gerenciamento de API keys
- [ ] Histórico de conversas
- [ ] Sistema de prompts otimizado

#### 5.4 Prompts Engineering
```typescript
const CHART_ANALYSIS_PROMPT = `
Você é um analista técnico experiente. Analise o gráfico fornecido e:
1. Identifique padrões de candlestick (doji, hammer, engulfing, etc)
2. Avalie tendências (alta, baixa, lateral)
3. Identifique suportes e resistências
4. Analise indicadores (médias móveis, volume)
5. Forneça um sinal de trading: strong_buy, buy, hold, sell, strong_sell
6. Justifique sua análise com base em análise técnica
`;
```

---

### **FASE 6: Interface de Chat com AI**
*Duração estimada: 2-3 dias*

#### 6.1 Componentes do Chat
- [ ] Sidebar responsiva (colapsável)
- [ ] Lista de mensagens com scroll automático
- [ ] Renderização de markdown
- [ ] Exibição de imagens inline
- [ ] Indicador de "digitando..."
- [ ] Mensagens com timestamp

#### 6.2 Seletor de AI
- [ ] Dropdown com providers disponíveis
- [ ] Indicador visual do provider ativo
- [ ] Configuração rápida (ícone de engrenagem)

#### 6.3 Input de Mensagem
- [ ] Textarea com auto-resize
- [ ] Botão de enviar
- [ ] Atalho de teclado (Enter)
- [ ] Anexar screenshot do gráfico atual
- [ ] Sugestões de análise rápida

#### 6.4 Features Avançadas
- [ ] Exportar conversa
- [ ] Limpar histórico
- [ ] Salvar análises favoritas

---

### **FASE 7: Sistema de Configurações**
*Duração estimada: 2 dias*

#### 7.1 Configurações de AI
- [ ] Gerenciamento de API keys
- [ ] Seleção de modelos
- [ ] Parâmetros de geração (temperatura, max tokens)
- [ ] Teste de conexão

#### 7.2 Configurações de Chart
- [ ] Temas de cores
- [ ] Configurações padrão de MAs
- [ ] Preferências de exibição

#### 7.3 Configurações Gerais
- [ ] Tema light/dark
- [ ] Idioma (preparar i18n)
- [ ] Preferências de cache
- [ ] Configurações de update

#### 7.4 Persistência
- [ ] Salvar configs em arquivo local
- [ ] Encryption de API keys
- [ ] Import/Export de configurações

---

### **FASE 8: Integração com Notícias**
*Duração estimada: 2 dias*

#### 8.1 News Service
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
}
```

#### 8.2 Providers de Notícias
- [ ] **NewsAPI** (notícias gerais)
- [ ] **CryptoPanic** (crypto news)
- [ ] **Finnhub** (stock news)
- [ ] Filtro por símbolo/palavra-chave

#### 8.3 Exibição de Notícias
- [ ] Painel de notícias recentes
- [ ] Filtro por relevância
- [ ] Link para artigo original
- [ ] Análise de sentimento (via AI)

---

### **FASE 9: Sistema de Build e Deploy**
*Duração estimada: 2-3 dias*

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
- [ ] Certificado para macOS (Apple Developer)
- [ ] Certificado para Windows (Sectigo, DigiCert)
- [ ] Configurar assinatura automática

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

### **FASE 10: Sistema de Auto-Update**
*Duração estimada: 2-3 dias*

#### 10.1 Electron Updater Setup
```typescript
// main/updater.ts
import { autoUpdater } from 'electron-updater';
import { app, dialog } from 'electron';

export class UpdateManager {
  private window: BrowserWindow;
  
  constructor(window: BrowserWindow) {
    this.window = window;
    this.setupAutoUpdater();
  }
  
  private setupAutoUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    
    autoUpdater.on('update-available', (info) => {
      this.window.webContents.send('update-available', info);
    });
    
    autoUpdater.on('update-downloaded', (info) => {
      this.window.webContents.send('update-downloaded', info);
    });
  }
  
  checkForUpdates() {
    autoUpdater.checkForUpdates();
  }
  
  downloadUpdate() {
    autoUpdater.downloadUpdate();
  }
  
  installUpdate() {
    autoUpdater.quitAndInstall();
  }
}
```

#### 10.2 Update Server
**Opções:**
- [ ] **GitHub Releases** (gratuito, simples)
- [ ] **S3 + CloudFront** (controle total)
- [ ] **Vercel/Netlify** (para metadata)

#### 10.3 Fluxo de Update
1. App abre → verifica updates automaticamente
2. Update disponível → notifica usuário
3. Usuário aceita → download em background
4. Download completo → solicita reinício
5. App reinicia → instala update

#### 10.4 UI de Updates
- [ ] Notificação de update disponível
- [ ] Barra de progresso de download
- [ ] Botão "Reiniciar e Atualizar"
- [ ] Opção de adiar update
- [ ] Release notes

---

### **FASE 11: Otimizações e Performance**
*Duração estimada: 2-3 dias*

#### 11.1 Canvas Performance
- [ ] Renderização apenas da área visível (viewport culling)
- [ ] Debounce em zoom/pan
- [ ] RequestAnimationFrame para animações
- [ ] Web Workers para cálculos pesados (MAs, indicadores)
- [ ] OffscreenCanvas (se necessário)

#### 11.2 Data Management
- [ ] Virtualização de grandes datasets
- [ ] Lazy loading de candles históricos
- [ ] IndexedDB para cache persistente
- [ ] Compressão de dados

#### 11.3 Memory Management
- [ ] Limpeza de canvas não utilizado
- [ ] Garbage collection consciente
- [ ] Limite de histórico de chat

---

### **FASE 12: Testes e Qualidade**
*Duração estimada: 3-4 dias*

#### 12.1 Setup de Testes
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D playwright # para testes E2E
```

#### 12.2 Testes Unitários
- [ ] Utilitários de canvas
- [ ] Cálculos de indicadores (SMA, EMA)
- [ ] Conversão de coordenadas
- [ ] Formatadores e validadores

#### 12.3 Testes de Integração
- [ ] Fluxo completo de carregamento de dados
- [ ] Interação com AI
- [ ] Sistema de updates

#### 12.4 Testes E2E
- [ ] Fluxo de abertura do app
- [ ] Carregar gráfico
- [ ] Conversar com AI
- [ ] Configurar settings

---

### **FASE 13: Documentação e Polimento**
*Duração estimada: 2 dias*

#### 13.1 Documentação
- [ ] README completo
- [ ] Guia de instalação
- [ ] Guia de desenvolvimento
- [ ] Documentação de APIs
- [ ] Troubleshooting

#### 13.2 Polimento de UI/UX
- [ ] Animações suaves
- [ ] Loading states
- [ ] Error handling visual
- [ ] Onboarding de primeiro uso
- [ ] Tooltips e hints

#### 13.3 Acessibilidade
- [ ] Suporte a teclado
- [ ] ARIA labels
- [ ] Contraste adequado
- [ ] Zoom de interface

---

## 🔧 Configurações Importantes

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

## 📦 Dependências Principais

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

### Tema Base
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

## 🚀 Cronograma Estimado

| Fase | Descrição | Duração | Prioridade |
|------|-----------|---------|------------|
| 1 | Setup Inicial | 1 dia | 🔴 Crítica |
| 2 | Sistema de Tipos | 1 dia | 🔴 Crítica |
| 3 | Renderização de Gráficos | 4-5 dias | 🔴 Crítica |
| 4 | Integração APIs de Mercado | 2-3 dias | 🔴 Crítica |
| 5 | Sistema de AI | 3-4 dias | 🔴 Crítica |
| 6 | Interface de Chat | 2-3 dias | 🟡 Alta |
| 7 | Sistema de Configurações | 2 dias | 🟡 Alta |
| 8 | Integração com Notícias | 2 dias | 🟢 Média |
| 9 | Build e Deploy | 2-3 dias | 🔴 Crítica |
| 10 | Auto-Update | 2-3 dias | 🟡 Alta |
| 11 | Otimizações | 2-3 dias | 🟡 Alta |
| 12 | Testes | 3-4 dias | 🟡 Alta |
| 13 | Documentação e Polimento | 2 dias | 🟢 Média |

**Total estimado: 26-35 dias** (assumindo trabalho em tempo integral)

---

## 📝 Checklist de MVP (Minimum Viable Product)

### Essencial para Lançamento v1.0
- [ ] Renderização de gráficos de candlestick
- [ ] Renderização de gráfico de linha
- [ ] Volume chart
- [ ] Grid e labels
- [ ] Pelo menos 2 médias móveis (SMA)
- [ ] Integração com 1 API de mercado (Binance para crypto)
- [ ] Integração com 1 AI (OpenAI GPT-4 Vision)
- [ ] Chat funcional com AI
- [ ] Seletor de AI
- [ ] Configurações básicas (API keys)
- [ ] Light e Dark mode
- [ ] Instalador para Mac e Windows
- [ ] Sistema de auto-update funcionando

### Nice to Have (v1.1+)
- [ ] Múltiplas APIs de mercado
- [ ] Múltiplos providers de AI
- [ ] Integração com notícias
- [ ] Análise de sentimento de notícias
- [ ] EMA (Exponential Moving Average)
- [ ] Mais indicadores técnicos (RSI, MACD, Bollinger Bands)
- [ ] Alertas de preço
- [ ] Watchlist de ativos
- [ ] Export de gráficos em imagem
- [ ] Temas customizados

---

## 🔐 Segurança

### API Keys
- Armazenar keys criptografadas usando `safeStorage` do Electron
- Nunca expor keys no renderer process
- Validar keys antes de salvar

### Updates
- Verificar assinatura de pacotes
- HTTPS obrigatório para servidor de updates
- Validação de checksums

### Network
- Rate limiting nas chamadas de API
- Timeout adequado em requests
- Retry com backoff exponencial

---

## 🐛 Debug e Logging

### Desenvolvimento
```typescript
// Ativar DevTools
if (process.env.NODE_ENV === 'development') {
  mainWindow.webContents.openDevTools();
}
```

### Logging
```typescript
// Usar electron-log
import log from 'electron-log';

log.info('App iniciado');
log.error('Erro ao carregar dados', error);
```

### Crash Reporting
- Considerar Sentry para produção
- Logs locais para debugging

---

## 📊 Métricas de Performance

### Targets
- **Tempo de carregamento inicial:** < 2s
- **Renderização de 1000 candles:** < 100ms
- **FPS durante pan/zoom:** > 30fps
- **Tempo de resposta da AI:** < 10s
- **Tamanho do instalador:** < 150MB

---

## 🔄 Fluxo de Desenvolvimento

### Branch Strategy
```
main (produção)
├── develop (desenvolvimento)
    ├── feature/chart-rendering
    ├── feature/ai-integration
    └── feature/auto-update
```

### Commits Semânticos
```
feat: adiciona renderização de candlestick
fix: corrige cálculo de SMA
docs: atualiza README com instruções
perf: otimiza renderização de canvas
```

---

## 📚 Recursos e Referências

### APIs de Mercado
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

### Canvas/Gráficos
- [HTML5 Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Konva.js](https://konvajs.org/)
- [TradingView Charting Library](https://www.tradingview.com/charting-library/) (pago, mas referência)

---

## 🎯 Próximos Passos Imediatos

### Para começar AGORA:
1. **Criar estrutura do projeto** (Fase 1)
   ```bash
   npm create vite@latest marketmind -- --template react-ts
   cd marketmind
   npm install
   ```

2. **Instalar dependências core**
   ```bash
   npm install electron electron-builder electron-updater
   npm install @chakra-ui/react @emotion/react @emotion/styled framer-motion
   npm install -D vite-plugin-electron concurrently
   ```

3. **Criar estrutura de pastas** conforme especificado

4. **Configurar Electron básico** com main process e renderer

5. **Setup Chakra UI** com tema light/dark

6. **Criar tipos base** (Fase 2)

---

## 💬 Instruções para Novos Chats

Quando iniciar um novo chat devido ao contexto ficar grande, forneça:

1. **Este documento** (PLANO_IMPLEMENTACAO.md)
2. **Fase atual** em que está trabalhando
3. **Arquivos já criados** (liste os principais)
4. **Problemas encontrados** (se houver)
5. **Próxima tarefa** desejada

### Exemplo de prompt:
```
Estou desenvolvendo o MarketMind conforme o PLANO_IMPLEMENTACAO.md.
Atualmente estou na FASE 3 (Renderização de Gráficos).
Já implementei: [listar arquivos/features]
Próximo passo: implementar o CandlestickRenderer.
```

---

## ✅ Conclusão

Este plano fornece um roadmap completo para desenvolver o MarketMind do zero até o lançamento. O projeto é ambicioso mas totalmente viável com as tecnologias escolhidas.

**Recomendação:** Siga as fases sequencialmente, garantindo que cada fase esteja sólida antes de avançar. Priorize o MVP antes de adicionar features "nice to have".

Boa sorte com o desenvolvimento! 🚀

---

**Versão do Documento:** 1.0  
**Data:** Novembro 2025  
**Autor:** Planejamento inicial para desenvolvimento do MarketMind
