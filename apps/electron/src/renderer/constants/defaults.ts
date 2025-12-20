import { CHART_CONFIG } from '@shared/constants/chartConfig';
import type { AdvancedControlsConfig } from '../components/Chart/AdvancedControls';
import type { MovingAverageConfig } from '../components/Chart/useMovingAverageRenderer';

export const DEFAULT_MOVING_AVERAGES: MovingAverageConfig[] = [
  {
    period: 9,
    type: 'EMA',
    color: '#ff9800',
    lineWidth: 2,
    visible: true,
  },
  {
    period: 21,
    type: 'EMA',
    color: '#2196f3',
    lineWidth: 2,
    visible: true,
  },
  {
    period: 50,
    type: 'EMA',
    color: '#4caf50',
    lineWidth: 2,
    visible: false,
  },
  {
    period: 70,
    type: 'EMA',
    color: '#00bcd4',
    lineWidth: 2,
    visible: false,
  },
  {
    period: 100,
    type: 'EMA',
    color: '#9c27b0',
    lineWidth: 2,
    visible: false,
  },
  {
    period: 200,
    type: 'EMA',
    color: '#f44336',
    lineWidth: 2,
    visible: false,
  },
];

export const DEFAULT_ADVANCED_CONFIG: AdvancedControlsConfig = {
  rightMargin: CHART_CONFIG.CHART_RIGHT_MARGIN,
  volumeHeightRatio: CHART_CONFIG.VOLUME_HEIGHT_RATIO,
  klineSpacing: CHART_CONFIG.KLINE_SPACING,
  klineWickWidth: CHART_CONFIG.KLINE_WICK_WIDTH,
  gridLineWidth: CHART_CONFIG.GRID_LINE_WIDTH,
  currentPriceLineWidth: CHART_CONFIG.CURRENT_PRICE_LINE_WIDTH,
  currentPriceLineStyle: CHART_CONFIG.CURRENT_PRICE_LINE_STYLE,
  paddingTop: CHART_CONFIG.CANVAS_PADDING_TOP,
  paddingBottom: CHART_CONFIG.CANVAS_PADDING_BOTTOM,
  paddingLeft: CHART_CONFIG.CANVAS_PADDING_LEFT,
  paddingRight: CHART_CONFIG.CANVAS_PADDING_RIGHT,
};

export const DEFAULT_AI_SETTINGS = {
  temperature: 0.7,
  maxTokens: 4096,
  detailedKlinesCount: 32,
} as const;

export const DEFAULT_NEWS_SETTINGS = {
  enabled: false,
  refreshInterval: 5,
  maxArticles: 10,
  pollingEnabled: true,
  minImportanceForToast: 50,
  correlateWithAI: false,
} as const;

export const DEFAULT_CALENDAR_SETTINGS = {
  enabled: false,
  showOnChart: true,
  minImportanceForChart: 'medium' as const,
  daysAhead: 30,
  daysBehind: 7,
  correlateWithAI: false,
} as const;

export const DEFAULT_AUTO_UPDATE_SETTINGS = {
  autoCheckUpdates: true,
  autoDownloadUpdates: true,
  updateCheckInterval: 24,
} as const;

export const DEFAULT_PROMPTS = {
  chartAnalysis: {
    system: "You are an expert technical analyst with deep knowledge of financial markets, chart patterns, and trading strategies. Your role is to analyze charts and provide actionable insights based on:\n\n1. **Kline Patterns**: Identify formations like doji, hammer, engulfing, shooting star, etc.\n2. **Trend Analysis**: Determine if the market is bullish, bearish, or sideways\n3. **Support & Resistance**: Identify key price levels\n4. **Technical Indicators**: Analyze moving averages, volume, and other visible indicators\n5. **Market Structure**: Evaluate higher highs/lows, lower highs/lows\n6. **Risk Assessment**: Consider potential entry, exit, and stop-loss levels\n7. **Market Events**: When provided, consider upcoming and recent events (conferences, releases, partnerships, etc.) that may impact price action\n8. **News Sentiment**: When provided, factor in recent news sentiment and major headlines\n\nProvide clear, concise analysis in a professional tone. Focus on what the chart is showing NOW, not predictions about the future. Use proper technical analysis terminology.\n\n**When news and events are provided:**\n- Reference important events by their importance level (CRITICAL, HIGH, MEDIUM, LOW)\n- Consider how upcoming events might create support/resistance levels or volatility\n- Note if recent events correlate with price movements on the chart\n- Mention if major news sentiment aligns or conflicts with technical signals\n\nFormat your response with:\n- **Summary**: Brief overview (2-3 sentences)\n- **Key Observations**: Bullet points of important findings\n- **Technical Assessment**: Detailed analysis of patterns and indicators\n- **Fundamental Context** (when events/news provided): How events/news relate to technical picture\n- **Current Signal**: One of: STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL\n- **Confidence**: Your confidence level (0-100%)\n- **Reasoning**: Why you chose this signal\n\n**CRITICAL - DRAWING PATTERNS ON THE CHART**:\n\nAfter your analysis, you MUST include a JSON block with technical patterns. The system will automatically draw these on the chart and assign them sequential numbers (1, 2, 3, etc.).\n\n⚠️ TIMESTAMP RULES (VERY IMPORTANT):\n- The chart data includes a \"TIMESTAMP INFORMATION\" section with exact timestamps\n- Use ONLY timestamps from that range (between First and Last Kline Timestamp)\n- For support/resistance lines: pick 2 timestamps where the level is visible\n- For zones: use startOpenTime and endOpenTime within the visible range\n- Example: If first kline is 1700000000000 and last is 1700086400000, use values between these\n\n⚠️ REFERENCING PATTERNS IN YOUR ANALYSIS:\n- When mentioning a pattern in your text analysis, reference it as \"Pattern #1\", \"Pattern #2\", etc.\n- The numbers correspond to the order of patterns in the JSON array (first pattern = #1, second = #2, etc.)\n- Example: \"As shown in Pattern #1, there's a strong support level at $42,000\"\n- Example: \"Pattern #3 highlights a potential buy zone where accumulation may occur\"\n- This allows users to identify which drawing you're referring to in the chart\n\nJSON Format:\n```json\n{\n  \"patterns\": [\n    {\n      \"type\": \"support\",\n      \"points\": [\n        {\"timestamp\": 1700020000000, \"price\": 42000},\n        {\"timestamp\": 1700080000000, \"price\": 42000}\n      ],\n      \"label\": \"Key Support Level\"\n    },\n    {\n      \"type\": \"buy-zone\",\n      \"topPrice\": 43500,\n      \"bottomPrice\": 42800,\n      \"startOpenTime\": 1700000000000,\n      \"endOpenTime\": 1700050000000,\n      \"label\": \"Accumulation Zone\"\n    }\n  ]\n}\n```\n\nAvailable types:\n- Lines: \"support\", \"resistance\", \"trendline-bullish\", \"trendline-bearish\"\n- Zones: \"liquidity-zone\", \"sell-zone\", \"buy-zone\", \"accumulation-zone\"\n\nYou can mention these levels in your analysis using their pattern numbers (Pattern #1, Pattern #2, etc.), and they will appear as numbered drawings on the chart.\n\nRemember: Past performance does not guarantee future results. Always mention this is analysis, not financial advice.",
    userTemplate: "Please analyze this financial chart and provide technical analysis.",
    contextTemplate: "\n\nAdditional Context: {context}",
    priceDataTemplate: "\n\nLatest Price Data:\n- Open: ${open}\n- High: ${high}\n- Low: ${low}\n- Close: ${close}\n- Volume: {volume}",
    newsTemplate: "\n\nRecent News Headlines:\n{newsItems}",
    eventsTemplate: "\n\nUpcoming & Recent Events:\n{eventItems}"
  },
  chat: {
    system: "You are a helpful AI assistant specialized in financial markets and trading. You can answer questions about technical analysis, market trends, trading strategies, and financial instruments. Always provide educational information and remind users that you don't provide financial advice.",
    disclaimer: "Remember: This is educational information only, not financial advice. Always do your own research and consult with a licensed financial advisor before making investment decisions."
  },
  signals: {
    strong_buy: {
      label: "STRONG BUY",
      description: "Very bullish indicators, strong upward momentum",
      color: "#22c55e"
    },
    buy: {
      label: "BUY",
      description: "Bullish indicators, potential upward movement",
      color: "#86efac"
    },
    hold: {
      label: "HOLD",
      description: "Neutral indicators, sideways movement expected",
      color: "#fbbf24"
    },
    sell: {
      label: "SELL",
      description: "Bearish indicators, potential downward movement",
      color: "#fca5a5"
    },
    strong_sell: {
      label: "STRONG SELL",
      description: "Very bearish indicators, strong downward momentum",
      color: "#ef4444"
    }
  }
} as const;
