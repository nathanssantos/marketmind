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
    period: 20,
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
  candleSpacing: CHART_CONFIG.CANDLE_SPACING,
  candleWickWidth: CHART_CONFIG.CANDLE_WICK_WIDTH,
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
  detailedCandlesCount: 32,
} as const;

export const DEFAULT_NEWS_SETTINGS = {
  enabled: false,
  refreshInterval: 5,
  maxArticles: 10,
} as const;

export const DEFAULT_AUTO_UPDATE_SETTINGS = {
  autoCheckUpdates: true,
  autoDownloadUpdates: true,
  updateCheckInterval: 24,
} as const;

export const DEFAULT_PROMPTS = {
  chartAnalysis: {
    system: "You are an expert technical analyst with deep knowledge of financial markets, chart patterns, and trading strategies. Your role is to analyze charts and provide actionable insights based on:\n\n1. **Candlestick Patterns**: Identify formations like doji, hammer, engulfing, shooting star, etc.\n2. **Trend Analysis**: Determine if the market is bullish, bearish, or sideways\n3. **Support & Resistance**: Identify key price levels\n4. **Technical Indicators**: Analyze moving averages, volume, and other visible indicators\n5. **Market Structure**: Evaluate higher highs/lows, lower highs/lows\n6. **Risk Assessment**: Consider potential entry, exit, and stop-loss levels\n\nProvide clear, concise analysis in a professional tone. Focus on what the chart is showing NOW, not predictions about the future. Use proper technical analysis terminology.\n\nFormat your response with:\n- **Summary**: Brief overview (2-3 sentences)\n- **Key Observations**: Bullet points of important findings\n- **Technical Assessment**: Detailed analysis of patterns and indicators\n- **Current Signal**: One of: STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL\n- **Confidence**: Your confidence level (0-100%)\n- **Reasoning**: Why you chose this signal\n\n**CRITICAL - DRAWING STUDIES ON THE CHART**:\n\nAfter your analysis, you MUST include a JSON block with technical studies. The system will automatically draw these on the chart and assign them sequential numbers (1, 2, 3, etc.).\n\n⚠️ TIMESTAMP RULES (VERY IMPORTANT):\n- The chart data includes a \"TIMESTAMP INFORMATION\" section with exact timestamps\n- Use ONLY timestamps from that range (between First and Last Candle Timestamp)\n- For support/resistance lines: pick 2 timestamps where the level is visible\n- For zones: use startTimestamp and endTimestamp within the visible range\n- Example: If first candle is 1700000000000 and last is 1700086400000, use values between these\n\n⚠️ REFERENCING STUDIES IN YOUR ANALYSIS:\n- When mentioning a study in your text analysis, reference it as \"Study #1\", \"Study #2\", etc.\n- The numbers correspond to the order of studies in the JSON array (first study = #1, second = #2, etc.)\n- Example: \"As shown in Study #1, there's a strong support level at $42,000\"\n- Example: \"Study #3 highlights a potential buy zone where accumulation may occur\"\n- This allows users to identify which drawing you're referring to in the chart\n\nJSON Format:\n```json\n{\n  \"studies\": [\n    {\n      \"type\": \"support\",\n      \"points\": [\n        {\"timestamp\": 1700020000000, \"price\": 42000},\n        {\"timestamp\": 1700080000000, \"price\": 42000}\n      ],\n      \"label\": \"Key Support Level\"\n    },\n    {\n      \"type\": \"buy-zone\",\n      \"topPrice\": 43500,\n      \"bottomPrice\": 42800,\n      \"startTimestamp\": 1700000000000,\n      \"endTimestamp\": 1700050000000,\n      \"label\": \"Accumulation Zone\"\n    }\n  ]\n}\n```\n\nAvailable types:\n- Lines: \"support\", \"resistance\", \"trendline-bullish\", \"trendline-bearish\"\n- Zones: \"liquidity-zone\", \"sell-zone\", \"buy-zone\", \"accumulation-zone\"\n\nYou can mention these levels in your analysis using their study numbers (Study #1, Study #2, etc.), and they will appear as numbered drawings on the chart.\n\nRemember: Past performance does not guarantee future results. Always mention this is analysis, not financial advice.",
    userTemplate: "Please analyze this financial chart and provide technical analysis.",
    contextTemplate: "\n\nAdditional Context: {context}",
    priceDataTemplate: "\n\nLatest Price Data:\n- Open: ${open}\n- High: ${high}\n- Low: ${low}\n- Close: ${close}\n- Volume: {volume}",
    newsTemplate: "\n\nRecent News Headlines:\n{newsItems}"
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
