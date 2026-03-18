export interface ChartPalette {
  id: string;
  name: string;
  bullish: string;
  bearish: string;
  background: string;
  grid: string;
}

export const CHART_PALETTES: Record<string, { light: ChartPalette; dark: ChartPalette }> = {
  default: {
    light: {
      id: 'default',
      name: 'TradingView',
      bullish: '#16a34a',
      bearish: '#dc2626',
      background: '#ffffff',
      grid: 'rgba(226, 232, 240, 0.8)',
    },
    dark: {
      id: 'default',
      name: 'TradingView',
      bullish: '#26a69a',
      bearish: '#ef5350',
      background: '#1e222d',
      grid: 'rgba(42, 46, 57, 0.5)',
    },
  },
  classic: {
    light: {
      id: 'classic',
      name: 'Classic B&W',
      bullish: '#4a4a4a',
      bearish: '#d4d4d4',
      background: '#ffffff',
      grid: 'rgba(200, 200, 200, 0.6)',
    },
    dark: {
      id: 'classic',
      name: 'Classic B&W',
      bullish: '#e0e0e0',
      bearish: '#3a3a3a',
      background: '#131722',
      grid: 'rgba(50, 55, 65, 0.5)',
    },
  },
  binance: {
    light: {
      id: 'binance',
      name: 'Binance',
      bullish: '#0ecb81',
      bearish: '#f6465d',
      background: '#fafafa',
      grid: 'rgba(220, 220, 220, 0.6)',
    },
    dark: {
      id: 'binance',
      name: 'Binance',
      bullish: '#0ecb81',
      bearish: '#f6465d',
      background: '#1e2329',
      grid: 'rgba(43, 47, 54, 0.8)',
    },
  },
  'blue-orange': {
    light: {
      id: 'blue-orange',
      name: 'Blue & Orange',
      bullish: '#1976d2',
      bearish: '#ff6d00',
      background: '#ffffff',
      grid: 'rgba(200, 210, 230, 0.6)',
    },
    dark: {
      id: 'blue-orange',
      name: 'Blue & Orange',
      bullish: '#42a5f5',
      bearish: '#ff9100',
      background: '#1a1a2e',
      grid: 'rgba(40, 40, 60, 0.6)',
    },
  },
  night: {
    light: {
      id: 'night',
      name: 'Night Owl',
      bullish: '#22c55e',
      bearish: '#e11d48',
      background: '#f8fafc',
      grid: 'rgba(210, 220, 235, 0.7)',
    },
    dark: {
      id: 'night',
      name: 'Night Owl',
      bullish: '#4ade80',
      bearish: '#fb7185',
      background: '#0f172a',
      grid: 'rgba(30, 41, 59, 0.8)',
    },
  },
};

export const PALETTE_IDS = Object.keys(CHART_PALETTES);

export const getPalette = (id: string, colorMode: 'light' | 'dark'): ChartPalette =>
  CHART_PALETTES[id]?.[colorMode] ?? CHART_PALETTES['default']![colorMode];
