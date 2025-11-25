import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const customConfig = defineConfig({
  theme: {
    semanticTokens: {
      colors: {
        'bg.panel': {
          value: {
            base: '#ffffff',
            _dark: '#1a202c',
          },
        },
        'bg.surface': {
          value: {
            base: '#f7fafc',
            _dark: '#2d3748',
          },
        },
        'bg.muted': {
          value: {
            base: '#edf2f7',
            _dark: '#4a5568',
          },
        },
        border: {
          value: {
            base: '#e2e8f0',
            _dark: '#4a5568',
          },
        },
        fg: {
          value: {
            base: '#1a202c',
            _dark: '#f7fafc',
          },
        },
        'fg.muted': {
          value: {
            base: '#718096',
            _dark: '#a0aec0',
          },
        },
        'chart.background': {
          value: {
            base: '#ffffff',
            _dark: '#1e222d',
          },
        },
        'chart.bullish': {
          value: {
            base: '#16a34a',
            _dark: '#26a69a',
          },
        },
        'chart.bearish': {
          value: {
            base: '#dc2626',
            _dark: '#ef5350',
          },
        },
        'chart.volume': {
          value: {
            base: 'rgba(100, 116, 139, 0.3)',
            _dark: 'rgba(120, 120, 120, 0.5)',
          },
        },
        'chart.grid': {
          value: {
            base: 'rgba(226, 232, 240, 0.8)',
            _dark: 'rgba(42, 46, 57, 0.5)',
          },
        },
        'chart.axis.label': {
          value: {
            base: 'rgba(60, 60, 60, 0.8)',
            _dark: 'rgba(200, 200, 200, 0.8)',
          },
        },
        'chart.crosshair': {
          value: {
            base: 'rgb(60, 60, 60)',
            _dark: 'rgb(200, 200, 200)',
          },
        },
        'chart.axis.line': {
          value: {
            base: 'rgba(100, 116, 139, 0.5)',
            _dark: 'rgba(200, 200, 200, 0.8)',
          },
        },
        'chart.currentPrice.label.bg': {
          value: {
            base: '#16a34a',
            _dark: '#26a69a',
          },
        },
        'chart.currentPrice.label.text': {
          value: {
            base: '#ffffff',
            _dark: '#ffffff',
          },
        },
        'chart.line.default': {
          value: {
            base: '#2563eb',
            _dark: '#2196f3',
          },
        },
        'chart.ma.1': {
          value: {
            base: '#2563eb',
            _dark: '#2196f3',
          },
        },
        'chart.ma.2': {
          value: {
            base: '#ea580c',
            _dark: '#ff9800',
          },
        },
        'chart.ma.3': {
          value: {
            base: '#7c3aed',
            _dark: '#9c27b0',
          },
        },
        'chart.aiStudy.support': {
          value: {
            base: '#14b8a6',
            _dark: '#26a69a',
          },
        },
        'chart.aiStudy.resistance': {
          value: {
            base: '#dc2626',
            _dark: '#ef5350',
          },
        },
        'chart.aiStudy.trendlineBullish': {
          value: {
            base: '#16a34a',
            _dark: '#4caf50',
          },
        },
        'chart.aiStudy.trendlineBearish': {
          value: {
            base: '#dc2626',
            _dark: '#f44336',
          },
        },
        'chart.aiStudy.liquidityZone': {
          value: {
            base: 'rgba(124, 58, 237, 0.15)',
            _dark: 'rgba(156, 39, 176, 0.2)',
          },
        },
        'chart.aiStudy.sellZone': {
          value: {
            base: 'rgba(220, 38, 38, 0.15)',
            _dark: 'rgba(244, 67, 54, 0.2)',
          },
        },
        'chart.aiStudy.buyZone': {
          value: {
            base: 'rgba(22, 163, 74, 0.15)',
            _dark: 'rgba(76, 175, 80, 0.2)',
          },
        },
        'chart.aiStudy.accumulationZone': {
          value: {
            base: 'rgba(37, 99, 235, 0.15)',
            _dark: 'rgba(33, 150, 243, 0.2)',
          },
        },
        'chart.aiStudy.tooltip.bg': {
          value: {
            base: 'rgba(124, 58, 237, 0.95)',
            _dark: 'rgba(138, 43, 226, 0.9)',
          },
        },
        'chart.aiStudy.tooltip.text': {
          value: {
            base: '#ffffff',
            _dark: '#ffffff',
          },
        },
        'chart.aiStudy.tooltip.border': {
          value: {
            base: 'rgba(124, 58, 237, 0.95)',
            _dark: 'rgba(138, 43, 226, 0.9)',
          },
        },
        'chart.stochastic.k': {
          value: {
            base: '#ea580c',
            _dark: '#ff5722',
          },
        },
        'chart.stochastic.d': {
          value: {
            base: '#2563eb',
            _dark: '#2196f3',
          },
        },
        'chart.stochastic.zone': {
          value: {
            base: 'rgba(128, 128, 128, 0.4)',
            _dark: 'rgba(128, 128, 128, 0.4)',
          },
        },
        'chart.rsi.line': {
          value: {
            base: '#7c3aed',
            _dark: '#9c27b0',
          },
        },
        'chart.rsi.zone': {
          value: {
            base: 'rgba(128, 128, 128, 0.4)',
            _dark: 'rgba(128, 128, 128, 0.4)',
          },
        },
      },
    },
  },
  globalCss: {
    body: {
      bg: 'bg.panel',
      color: 'fg',
      userSelect: 'text',
    },
  },
});

export const system = createSystem(defaultConfig, customConfig);

export const getChartColors = (colorMode: 'light' | 'dark') => {
  const tokens = customConfig.theme?.semanticTokens?.colors || {};
  
  const resolveValue = (token: any) => {
    if (!token?.value) return '';
    if (typeof token.value === 'string') return token.value;
    return colorMode === 'dark' ? (token.value._dark || token.value.base) : token.value.base;
  };

  return {
    background: resolveValue(tokens['chart.background']),
    bullish: resolveValue(tokens['chart.bullish']),
    bearish: resolveValue(tokens['chart.bearish']),
    volume: resolveValue(tokens['chart.volume']),
    grid: resolveValue(tokens['chart.grid']),
    axisLabel: resolveValue(tokens['chart.axis.label']),
    axisLine: resolveValue(tokens['chart.axis.line']),
    crosshair: resolveValue(tokens['chart.crosshair']),
    currentPriceLabel: {
      bg: resolveValue(tokens['chart.currentPrice.label.bg']),
      text: resolveValue(tokens['chart.currentPrice.label.text']),
    },
    lineDefault: resolveValue(tokens['chart.line.default']),
    ma: [
      resolveValue(tokens['chart.ma.1']),
      resolveValue(tokens['chart.ma.2']),
      resolveValue(tokens['chart.ma.3']),
    ],
    aiStudy: {
      support: resolveValue(tokens['chart.aiStudy.support']),
      resistance: resolveValue(tokens['chart.aiStudy.resistance']),
      trendlineBullish: resolveValue(tokens['chart.aiStudy.trendlineBullish']),
      trendlineBearish: resolveValue(tokens['chart.aiStudy.trendlineBearish']),
      liquidityZone: resolveValue(tokens['chart.aiStudy.liquidityZone']),
      sellZone: resolveValue(tokens['chart.aiStudy.sellZone']),
      buyZone: resolveValue(tokens['chart.aiStudy.buyZone']),
      accumulationZone: resolveValue(tokens['chart.aiStudy.accumulationZone']),
      tooltip: {
        bg: resolveValue(tokens['chart.aiStudy.tooltip.bg']),
        text: resolveValue(tokens['chart.aiStudy.tooltip.text']),
        border: resolveValue(tokens['chart.aiStudy.tooltip.border']),
      },
    },
    stochastic: {
      k: resolveValue(tokens['chart.stochastic.k']),
      d: resolveValue(tokens['chart.stochastic.d']),
      zone: resolveValue(tokens['chart.stochastic.zone']),
    },
    rsi: {
      line: resolveValue(tokens['chart.rsi.line']),
      zone: resolveValue(tokens['chart.rsi.zone']),
    },
  };
};
