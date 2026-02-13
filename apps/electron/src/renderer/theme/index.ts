import { createSystem, defaultConfig, defineConfig, defineRecipe, defineSlotRecipe } from '@chakra-ui/react';
import { FIBONACCI_DEFAULT_COLOR } from '@marketmind/fibonacci';

const FIBONACCI_LINE_COLOR = FIBONACCI_DEFAULT_COLOR;

export const badgeRecipe = defineRecipe({
  base: { px: 1.5, py: 0.5, borderRadius: 'sm', fontSize: '2xs', fontWeight: 'medium' },
  variants: {
    variant: {
      interval: { bg: { base: 'blue.100', _dark: 'blue.900' }, color: { base: 'blue.800', _dark: 'blue.200' } },
      futures: { bg: { base: 'orange.100', _dark: 'orange.900' }, color: { base: 'orange.800', _dark: 'orange.200' } },
      spot: { bg: { base: 'green.100', _dark: 'green.900' }, color: { base: 'green.800', _dark: 'green.200' } },
      count: { bg: { base: 'green.100', _dark: 'green.900' }, color: { base: 'green.800', _dark: 'green.200' }, borderRadius: 'full', fontSize: 'xs' },
      active: { bg: { base: 'purple.100', _dark: 'purple.900' }, color: { base: 'purple.800', _dark: 'purple.200' }, borderRadius: 'full', fontSize: 'xs' },
      autoRotation: { bg: { base: 'blue.100', _dark: 'blue.900' }, color: { base: 'blue.800', _dark: 'blue.200' }, borderRadius: 'full', fontSize: 'xs' },
    },
  },
});

export const collapsibleSectionRecipe = defineSlotRecipe({
  slots: ['root', 'trigger', 'title', 'description', 'content'],
  base: {
    trigger: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      w: '100%',
      cursor: 'pointer',
      _hover: { bg: 'bg.subtle' },
      borderRadius: 'md',
      px: 2,
      bg: 'transparent',
      border: 'none',
      textAlign: 'left',
    },
    title: { fontWeight: 'bold' },
    description: { color: 'fg.muted' },
  },
  variants: {
    size: {
      sm: { trigger: { py: 2 }, title: { fontSize: 'xs', fontWeight: 'semibold' }, description: { fontSize: 'xs' } },
      md: { trigger: { py: 3 }, title: { fontSize: 'sm', fontWeight: 'semibold' }, description: { fontSize: 'xs' } },
      lg: { trigger: { py: 2 }, title: { fontSize: 'lg' }, description: { fontSize: 'sm' } },
    },
  },
  defaultVariants: { size: 'lg' },
});

export const filterToggleRecipe = defineSlotRecipe({
  slots: ['root', 'label', 'description'],
  base: {
    root: { p: 3, bg: 'bg.muted', borderRadius: 'md', borderWidth: '1px' },
    label: { fontSize: 'sm', fontWeight: 'medium' },
    description: { fontSize: 'xs', color: 'fg.muted', mt: 1 },
  },
  variants: {
    status: {
      active: { root: { borderColor: 'green.500' } },
      inactive: { root: { borderColor: 'border' } },
      disabled: { root: { borderColor: 'border', opacity: 0.45 } },
    },
  },
  defaultVariants: { status: 'inactive' },
});

const customConfig = defineConfig({
  theme: {
    recipes: {
      badge: badgeRecipe,
    },
    slotRecipes: {
      collapsibleSection: collapsibleSectionRecipe,
      filterToggle: filterToggleRecipe,
    },
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
        'chart.currentPrice.line': {
          value: {
            base: '#374151',
            _dark: '#ffffff',
          },
        },
        'chart.currentPrice.label.bg': {
          value: {
            base: '#374151',
            _dark: '#ffffff',
          },
        },
        'chart.currentPrice.label.text': {
          value: {
            base: '#ffffff',
            _dark: '#000000',
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
            base: 'rgba(128, 128, 128, 0.7)',
            _dark: 'rgba(128, 128, 128, 0.7)',
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
            base: 'rgba(128, 128, 128, 0.7)',
            _dark: 'rgba(128, 128, 128, 0.7)',
          },
        },
        'chart.bollingerBands.upper': {
          value: {
            base: 'rgba(33, 150, 243, 0.6)',
            _dark: 'rgba(33, 150, 243, 0.6)',
          },
        },
        'chart.bollingerBands.middle': {
          value: {
            base: 'rgba(33, 150, 243, 0.9)',
            _dark: 'rgba(33, 150, 243, 0.9)',
          },
        },
        'chart.bollingerBands.lower': {
          value: {
            base: 'rgba(33, 150, 243, 0.6)',
            _dark: 'rgba(33, 150, 243, 0.6)',
          },
        },
        'chart.bollingerBands.fill': {
          value: {
            base: 'rgba(33, 150, 243, 0.08)',
            _dark: 'rgba(33, 150, 243, 0.08)',
          },
        },
        'chart.atr.line': {
          value: {
            base: '#ff9800',
            _dark: '#ff9800',
          },
        },
        'chart.macd.macdLine': {
          value: {
            base: '#2563eb',
            _dark: '#2196f3',
          },
        },
        'chart.macd.signalLine': {
          value: {
            base: '#ea580c',
            _dark: '#ff9800',
          },
        },
        'chart.macd.histogramPositive': {
          value: {
            base: 'rgba(22, 163, 74, 0.7)',
            _dark: 'rgba(38, 166, 154, 0.7)',
          },
        },
        'chart.macd.histogramNegative': {
          value: {
            base: 'rgba(220, 38, 38, 0.7)',
            _dark: 'rgba(239, 83, 80, 0.7)',
          },
        },
        'chart.macd.zeroLine': {
          value: {
            base: 'rgba(128, 128, 128, 0.5)',
            _dark: 'rgba(128, 128, 128, 0.5)',
          },
        },
        'chart.adx.adxLine': {
          value: {
            base: '#f59e0b',
            _dark: '#ffc107',
          },
        },
        'chart.adx.plusDI': {
          value: {
            base: '#16a34a',
            _dark: '#4caf50',
          },
        },
        'chart.adx.minusDI': {
          value: {
            base: '#dc2626',
            _dark: '#f44336',
          },
        },
        'chart.adx.threshold': {
          value: {
            base: 'rgba(128, 128, 128, 0.5)',
            _dark: 'rgba(128, 128, 128, 0.5)',
          },
        },
        'chart.williamsR.line': {
          value: {
            base: '#8b5cf6',
            _dark: '#a855f7',
          },
        },
        'chart.williamsR.zone': {
          value: {
            base: 'rgba(128, 128, 128, 0.7)',
            _dark: 'rgba(128, 128, 128, 0.7)',
          },
        },
        'chart.cci.line': {
          value: {
            base: '#06b6d4',
            _dark: '#22d3ee',
          },
        },
        'chart.cci.zone': {
          value: {
            base: 'rgba(128, 128, 128, 0.7)',
            _dark: 'rgba(128, 128, 128, 0.7)',
          },
        },
        'chart.ichimoku.tenkan': {
          value: {
            base: '#2563eb',
            _dark: '#2196f3',
          },
        },
        'chart.ichimoku.kijun': {
          value: {
            base: '#dc2626',
            _dark: '#f44336',
          },
        },
        'chart.ichimoku.senkouAFill': {
          value: {
            base: 'rgba(22, 163, 74, 0.2)',
            _dark: 'rgba(76, 175, 80, 0.2)',
          },
        },
        'chart.ichimoku.senkouBFill': {
          value: {
            base: 'rgba(220, 38, 38, 0.2)',
            _dark: 'rgba(244, 67, 54, 0.2)',
          },
        },
        'chart.ichimoku.chikou': {
          value: {
            base: '#16a34a',
            _dark: '#4caf50',
          },
        },
        'chart.supertrend.up': {
          value: {
            base: '#16a34a',
            _dark: '#4caf50',
          },
        },
        'chart.supertrend.down': {
          value: {
            base: '#dc2626',
            _dark: '#f44336',
          },
        },
        'chart.parabolicSar.bullish': {
          value: {
            base: '#16a34a',
            _dark: '#4caf50',
          },
        },
        'chart.parabolicSar.bearish': {
          value: {
            base: '#dc2626',
            _dark: '#f44336',
          },
        },
        'chart.obv.line': {
          value: {
            base: '#7c3aed',
            _dark: '#9c27b0',
          },
        },
        'chart.obv.sma': {
          value: {
            base: '#ea580c',
            _dark: '#ff9800',
          },
        },
        'chart.cmf.positive': {
          value: {
            base: 'rgba(22, 163, 74, 0.7)',
            _dark: 'rgba(38, 166, 154, 0.7)',
          },
        },
        'chart.cmf.negative': {
          value: {
            base: 'rgba(220, 38, 38, 0.7)',
            _dark: 'rgba(239, 83, 80, 0.7)',
          },
        },
        'chart.keltner.upper': {
          value: {
            base: '#7c3aed',
            _dark: '#9c27b0',
          },
        },
        'chart.keltner.middle': {
          value: {
            base: '#7c3aed',
            _dark: '#9c27b0',
          },
        },
        'chart.keltner.lower': {
          value: {
            base: '#7c3aed',
            _dark: '#9c27b0',
          },
        },
        'chart.keltner.fill': {
          value: {
            base: 'rgba(124, 58, 237, 0.1)',
            _dark: 'rgba(156, 39, 176, 0.1)',
          },
        },
        'chart.donchian.upper': {
          value: {
            base: '#0d9488',
            _dark: '#009688',
          },
        },
        'chart.donchian.middle': {
          value: {
            base: '#0d9488',
            _dark: '#009688',
          },
        },
        'chart.donchian.lower': {
          value: {
            base: '#0d9488',
            _dark: '#009688',
          },
        },
        'chart.donchian.fill': {
          value: {
            base: 'rgba(13, 148, 136, 0.1)',
            _dark: 'rgba(0, 150, 136, 0.1)',
          },
        },
        'chart.stochRsi.k': {
          value: {
            base: '#2563eb',
            _dark: '#2196f3',
          },
        },
        'chart.stochRsi.d': {
          value: {
            base: '#ea580c',
            _dark: '#ff9800',
          },
        },
        'chart.klinger.kvoLine': {
          value: {
            base: '#1e40af',
            _dark: '#2962ff',
          },
        },
        'chart.klinger.signalLine': {
          value: {
            base: '#ea580c',
            _dark: '#ff6d00',
          },
        },
        'chart.klinger.zeroLine': {
          value: {
            base: '#9ca3af',
            _dark: '#6b7280',
          },
        },
        'chart.elderRay.bullPower': {
          value: {
            base: '#16a34a',
            _dark: '#26a69a',
          },
        },
        'chart.elderRay.bearPower': {
          value: {
            base: '#dc2626',
            _dark: '#ef5350',
          },
        },
        'chart.aroon.upLine': {
          value: {
            base: '#16a34a',
            _dark: '#26a69a',
          },
        },
        'chart.aroon.downLine': {
          value: {
            base: '#dc2626',
            _dark: '#ef5350',
          },
        },
        'chart.aroon.zone': {
          value: {
            base: 'rgba(128, 128, 128, 0.3)',
            _dark: 'rgba(128, 128, 128, 0.3)',
          },
        },
        'chart.vortex.viPlusLine': {
          value: {
            base: '#16a34a',
            _dark: '#26a69a',
          },
        },
        'chart.vortex.viMinusLine': {
          value: {
            base: '#dc2626',
            _dark: '#ef5350',
          },
        },
        'chart.mfi.line': {
          value: {
            base: '#7e22ce',
            _dark: '#9c27b0',
          },
        },
        'chart.mfi.zone': {
          value: {
            base: 'rgba(128, 128, 128, 0.3)',
            _dark: 'rgba(128, 128, 128, 0.3)',
          },
        },
        'chart.roc.line': {
          value: {
            base: '#0891b2',
            _dark: '#00bcd4',
          },
        },
        'chart.ao.positive': {
          value: {
            base: '#16a34a',
            _dark: '#26a69a',
          },
        },
        'chart.ao.negative': {
          value: {
            base: '#dc2626',
            _dark: '#ef5350',
          },
        },
        'chart.tsi.tsiLine': {
          value: {
            base: '#1e40af',
            _dark: '#2962ff',
          },
        },
        'chart.tsi.signalLine': {
          value: {
            base: '#ea580c',
            _dark: '#ff6d00',
          },
        },
        'chart.ppo.ppoLine': {
          value: {
            base: '#1e40af',
            _dark: '#2962ff',
          },
        },
        'chart.ppo.signalLine': {
          value: {
            base: '#ea580c',
            _dark: '#ff6d00',
          },
        },
        'chart.ppo.histogramPositive': {
          value: {
            base: '#16a34a',
            _dark: '#26a69a',
          },
        },
        'chart.ppo.histogramNegative': {
          value: {
            base: '#dc2626',
            _dark: '#ef5350',
          },
        },
        'chart.ppo.zeroLine': {
          value: {
            base: '#9ca3af',
            _dark: '#6b7280',
          },
        },
        'chart.cmo.line': {
          value: {
            base: '#1d4ed8',
            _dark: '#2196f3',
          },
        },
        'chart.cmo.zone': {
          value: {
            base: 'rgba(128, 128, 128, 0.3)',
            _dark: 'rgba(128, 128, 128, 0.3)',
          },
        },
        'chart.ultimateOsc.line': {
          value: {
            base: '#6d28d9',
            _dark: '#673ab7',
          },
        },
        'chart.ultimateOsc.zone': {
          value: {
            base: 'rgba(128, 128, 128, 0.3)',
            _dark: 'rgba(128, 128, 128, 0.3)',
          },
        },
        'chart.dema.line': {
          value: {
            base: '#ea580c',
            _dark: '#ff9800',
          },
        },
        'chart.tema.line': {
          value: {
            base: '#be185d',
            _dark: '#e91e63',
          },
        },
        'chart.wma.line': {
          value: {
            base: '#7e22ce',
            _dark: '#9c27b0',
          },
        },
        'chart.hma.line': {
          value: {
            base: '#0891b2',
            _dark: '#00bcd4',
          },
        },
        'chart.pivotPoints.pivot': {
          value: {
            base: '#1d4ed8',
            _dark: '#2196f3',
          },
        },
        'chart.pivotPoints.support': {
          value: {
            base: '#16a34a',
            _dark: '#22c55e',
          },
        },
        'chart.pivotPoints.resistance': {
          value: {
            base: '#dc2626',
            _dark: '#ef4444',
          },
        },
        'chart.fibonacci.level0': {
          value: { base: FIBONACCI_LINE_COLOR, _dark: FIBONACCI_LINE_COLOR },
        },
        'chart.fibonacci.level236': {
          value: { base: FIBONACCI_LINE_COLOR, _dark: FIBONACCI_LINE_COLOR },
        },
        'chart.fibonacci.level382': {
          value: { base: FIBONACCI_LINE_COLOR, _dark: FIBONACCI_LINE_COLOR },
        },
        'chart.fibonacci.level50': {
          value: { base: FIBONACCI_LINE_COLOR, _dark: FIBONACCI_LINE_COLOR },
        },
        'chart.fibonacci.level618': {
          value: { base: FIBONACCI_LINE_COLOR, _dark: FIBONACCI_LINE_COLOR },
        },
        'chart.fibonacci.level786': {
          value: { base: FIBONACCI_LINE_COLOR, _dark: FIBONACCI_LINE_COLOR },
        },
        'chart.fibonacci.level100': {
          value: { base: FIBONACCI_LINE_COLOR, _dark: FIBONACCI_LINE_COLOR },
        },
        'chart.fibonacci.level127': {
          value: { base: FIBONACCI_LINE_COLOR, _dark: FIBONACCI_LINE_COLOR },
        },
        'chart.fibonacci.level138': {
          value: { base: FIBONACCI_LINE_COLOR, _dark: FIBONACCI_LINE_COLOR },
        },
        'chart.fibonacci.level161': {
          value: { base: FIBONACCI_LINE_COLOR, _dark: FIBONACCI_LINE_COLOR },
        },
        'chart.fibonacci.level200': {
          value: { base: FIBONACCI_LINE_COLOR, _dark: FIBONACCI_LINE_COLOR },
        },
        'chart.fibonacci.level261': {
          value: { base: FIBONACCI_LINE_COLOR, _dark: FIBONACCI_LINE_COLOR },
        },
        'chart.fibonacci.level886': {
          value: { base: FIBONACCI_LINE_COLOR, _dark: FIBONACCI_LINE_COLOR },
        },
        'chart.fibonacci.level300': {
          value: { base: FIBONACCI_LINE_COLOR, _dark: FIBONACCI_LINE_COLOR },
        },
        'chart.fibonacci.level361': {
          value: { base: FIBONACCI_LINE_COLOR, _dark: FIBONACCI_LINE_COLOR },
        },
        'chart.fibonacci.level423': {
          value: { base: FIBONACCI_LINE_COLOR, _dark: FIBONACCI_LINE_COLOR },
        },
        'chart.fvg.bullish': {
          value: {
            base: 'rgba(34, 197, 94, 0.2)',
            _dark: 'rgba(34, 197, 94, 0.2)',
          },
        },
        'chart.fvg.bearish': {
          value: {
            base: 'rgba(239, 68, 68, 0.2)',
            _dark: 'rgba(239, 68, 68, 0.2)',
          },
        },
        'chart.fvg.bullishBorder': {
          value: {
            base: 'rgba(34, 197, 94, 0.5)',
            _dark: 'rgba(34, 197, 94, 0.5)',
          },
        },
        'chart.fvg.bearishBorder': {
          value: {
            base: 'rgba(239, 68, 68, 0.5)',
            _dark: 'rgba(239, 68, 68, 0.5)',
          },
        },
        'chart.liquidityLevels.support': {
          value: {
            base: '#16a34a',
            _dark: '#22c55e',
          },
        },
        'chart.liquidityLevels.resistance': {
          value: {
            base: '#dc2626',
            _dark: '#ef4444',
          },
        },
        'chart.liquidityLevels.supportBg': {
          value: {
            base: 'rgba(34, 197, 94, 0.1)',
            _dark: 'rgba(34, 197, 94, 0.1)',
          },
        },
        'chart.liquidityLevels.resistanceBg': {
          value: {
            base: 'rgba(239, 68, 68, 0.1)',
            _dark: 'rgba(239, 68, 68, 0.1)',
          },
        },
        'chart.indicator.zone': {
          value: {
            base: 'rgba(128, 128, 128, 0.7)',
            _dark: 'rgba(128, 128, 128, 0.7)',
          },
        },
        'chart.panel.background': {
          value: {
            base: 'rgba(128, 128, 128, 0.02)',
            _dark: 'rgba(128, 128, 128, 0.02)',
          },
        },
        'chart.panel.scaleLabel': {
          value: {
            base: 'rgba(128, 128, 128, 0.6)',
            _dark: 'rgba(128, 128, 128, 0.6)',
          },
        },
        'chart.panel.label': {
          value: {
            base: 'rgba(128, 128, 128, 0.5)',
            _dark: 'rgba(128, 128, 128, 0.5)',
          },
        },
        'chart.ma.4': {
          value: {
            base: '#0d9488',
            _dark: '#14b8a6',
          },
        },
        'chart.ma.5': {
          value: {
            base: '#db2777',
            _dark: '#ec4899',
          },
        },
        'chart.ma.6': {
          value: {
            base: '#ca8a04',
            _dark: '#eab308',
          },
        },
        'chart.ma.7': {
          value: {
            base: '#4f46e5',
            _dark: '#6366f1',
          },
        },
        'chart.ma.8': {
          value: {
            base: '#059669',
            _dark: '#10b981',
          },
        },
        'trading.profit': {
          value: {
            base: '#16a34a',
            _dark: '#22c55e',
          },
        },
        'trading.loss': {
          value: {
            base: '#dc2626',
            _dark: '#ef4444',
          },
        },
        'trading.neutral': {
          value: {
            base: '#64748b',
            _dark: '#94a3b8',
          },
        },
        'trading.warning': {
          value: {
            base: '#f59e0b',
            _dark: '#fbbf24',
          },
        },
        'trading.info': {
          value: {
            base: '#2563eb',
            _dark: '#3b82f6',
          },
        },
        'trading.long': {
          value: {
            base: '#16a34a',
            _dark: '#22c55e',
          },
        },
        'trading.short': {
          value: {
            base: '#dc2626',
            _dark: '#ef4444',
          },
        },
        'bg.loading': {
          value: {
            base: '#f7fafc',
            _dark: '#1a1a2e',
          },
        },
        'bg.error': {
          value: {
            base: '#fef2f2',
            _dark: '#1c1917',
          },
        },
        'bg.success': {
          value: {
            base: '#f0fdf4',
            _dark: '#14532d',
          },
        },
        'bg.warning': {
          value: {
            base: '#fffbeb',
            _dark: '#451a03',
          },
        },
        'overlay.dark': {
          value: 'rgba(0, 0, 0, 0.5)',
        },
        'overlay.light': {
          value: 'rgba(255, 255, 255, 0.5)',
        },
        'canvas.text': {
          value: {
            base: '#ffffff',
            _dark: '#ffffff',
          },
        },
        'canvas.priceTag.bullish': {
          value: {
            base: 'rgba(34, 197, 94, 0.9)',
            _dark: 'rgba(34, 197, 94, 0.9)',
          },
        },
        'canvas.priceTag.bearish': {
          value: {
            base: 'rgba(239, 68, 68, 0.9)',
            _dark: 'rgba(239, 68, 68, 0.9)',
          },
        },
        'canvas.priceTag.info': {
          value: {
            base: 'rgba(59, 130, 246, 0.9)',
            _dark: 'rgba(59, 130, 246, 0.9)',
          },
        },
        'canvas.priceTag.neutral': {
          value: {
            base: 'rgba(100, 116, 139, 0.9)',
            _dark: 'rgba(148, 163, 184, 0.9)',
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
  
  const resolveValue = (token: unknown): string => {
    if (!token || typeof token !== 'object' || !('value' in token)) return '';
    const tokenValue = (token as { value: string | { base: string; _dark?: string } }).value;
    if (typeof tokenValue === 'string') return tokenValue;
    return colorMode === 'dark' ? (tokenValue._dark || tokenValue.base) : tokenValue.base;
  };

  return {
    background: resolveValue(tokens['chart.background']),
    bullish: resolveValue(tokens['chart.bullish']),
    bearish: resolveValue(tokens['chart.bearish']),
    volume: resolveValue(tokens['chart.volume']),
    grid: resolveValue(tokens['chart.grid']),
    text: resolveValue(tokens['chart.axis.label']),
    axisLabel: resolveValue(tokens['chart.axis.label']),
    axisLine: resolveValue(tokens['chart.axis.line']),
    crosshair: resolveValue(tokens['chart.crosshair']),
    currentPriceLine: resolveValue(tokens['chart.currentPrice.line']),
    currentPriceLabel: {
      bg: resolveValue(tokens['chart.currentPrice.label.bg']),
      text: resolveValue(tokens['chart.currentPrice.label.text']),
    },
    lineDefault: resolveValue(tokens['chart.line.default']),
    watermark: colorMode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
    highlighted: colorMode === 'dark' ? '#ffeb3b' : '#ffc107',
    line: resolveValue(tokens['chart.line.default']),
    ma: [
      resolveValue(tokens['chart.ma.1']),
      resolveValue(tokens['chart.ma.2']),
      resolveValue(tokens['chart.ma.3']),
      resolveValue(tokens['chart.ma.4']),
      resolveValue(tokens['chart.ma.5']),
      resolveValue(tokens['chart.ma.6']),
      resolveValue(tokens['chart.ma.7']),
      resolveValue(tokens['chart.ma.8']),
    ],
    stochastic: {
      k: resolveValue(tokens['chart.stochastic.k']),
      d: resolveValue(tokens['chart.stochastic.d']),
      zone: resolveValue(tokens['chart.stochastic.zone']),
    },
    rsi: {
      line: resolveValue(tokens['chart.rsi.line']),
      zone: resolveValue(tokens['chart.rsi.zone']),
    },
    bollingerBands: {
      upper: resolveValue(tokens['chart.bollingerBands.upper']),
      middle: resolveValue(tokens['chart.bollingerBands.middle']),
      lower: resolveValue(tokens['chart.bollingerBands.lower']),
      fill: resolveValue(tokens['chart.bollingerBands.fill']),
    },
    atr: {
      line: resolveValue(tokens['chart.atr.line']),
    },
    macd: {
      macdLine: resolveValue(tokens['chart.macd.macdLine']),
      signalLine: resolveValue(tokens['chart.macd.signalLine']),
      histogramPositive: resolveValue(tokens['chart.macd.histogramPositive']),
      histogramNegative: resolveValue(tokens['chart.macd.histogramNegative']),
      zeroLine: resolveValue(tokens['chart.macd.zeroLine']),
    },
    adx: {
      adxLine: resolveValue(tokens['chart.adx.adxLine']),
      plusDI: resolveValue(tokens['chart.adx.plusDI']),
      minusDI: resolveValue(tokens['chart.adx.minusDI']),
      threshold: resolveValue(tokens['chart.adx.threshold']),
    },
    williamsR: {
      line: resolveValue(tokens['chart.williamsR.line']),
      zone: resolveValue(tokens['chart.williamsR.zone']),
    },
    cci: {
      line: resolveValue(tokens['chart.cci.line']),
      zone: resolveValue(tokens['chart.cci.zone']),
    },
    ichimoku: {
      tenkan: resolveValue(tokens['chart.ichimoku.tenkan']),
      kijun: resolveValue(tokens['chart.ichimoku.kijun']),
      senkouAFill: resolveValue(tokens['chart.ichimoku.senkouAFill']),
      senkouBFill: resolveValue(tokens['chart.ichimoku.senkouBFill']),
      chikou: resolveValue(tokens['chart.ichimoku.chikou']),
    },
    supertrend: {
      up: resolveValue(tokens['chart.supertrend.up']),
      down: resolveValue(tokens['chart.supertrend.down']),
    },
    parabolicSar: {
      bullish: resolveValue(tokens['chart.parabolicSar.bullish']),
      bearish: resolveValue(tokens['chart.parabolicSar.bearish']),
    },
    keltner: {
      upper: resolveValue(tokens['chart.keltner.upper']),
      middle: resolveValue(tokens['chart.keltner.middle']),
      lower: resolveValue(tokens['chart.keltner.lower']),
      fill: resolveValue(tokens['chart.keltner.fill']),
    },
    donchian: {
      upper: resolveValue(tokens['chart.donchian.upper']),
      middle: resolveValue(tokens['chart.donchian.middle']),
      lower: resolveValue(tokens['chart.donchian.lower']),
      fill: resolveValue(tokens['chart.donchian.fill']),
    },
    obv: {
      line: resolveValue(tokens['chart.obv.line']),
      sma: resolveValue(tokens['chart.obv.sma']),
    },
    cmf: {
      positive: resolveValue(tokens['chart.cmf.positive']),
      negative: resolveValue(tokens['chart.cmf.negative']),
    },
    stochRsi: {
      k: resolveValue(tokens['chart.stochRsi.k']),
      d: resolveValue(tokens['chart.stochRsi.d']),
    },
    klinger: {
      kvoLine: resolveValue(tokens['chart.klinger.kvoLine']),
      signalLine: resolveValue(tokens['chart.klinger.signalLine']),
      zeroLine: resolveValue(tokens['chart.klinger.zeroLine']),
    },
    elderRay: {
      bullPower: resolveValue(tokens['chart.elderRay.bullPower']),
      bearPower: resolveValue(tokens['chart.elderRay.bearPower']),
    },
    aroon: {
      upLine: resolveValue(tokens['chart.aroon.upLine']),
      downLine: resolveValue(tokens['chart.aroon.downLine']),
      zone: resolveValue(tokens['chart.aroon.zone']),
    },
    vortex: {
      viPlusLine: resolveValue(tokens['chart.vortex.viPlusLine']),
      viMinusLine: resolveValue(tokens['chart.vortex.viMinusLine']),
    },
    mfi: {
      line: resolveValue(tokens['chart.mfi.line']),
      zone: resolveValue(tokens['chart.mfi.zone']),
    },
    roc: {
      line: resolveValue(tokens['chart.roc.line']),
    },
    ao: {
      positive: resolveValue(tokens['chart.ao.positive']),
      negative: resolveValue(tokens['chart.ao.negative']),
    },
    tsi: {
      tsiLine: resolveValue(tokens['chart.tsi.tsiLine']),
      signalLine: resolveValue(tokens['chart.tsi.signalLine']),
    },
    ppo: {
      ppoLine: resolveValue(tokens['chart.ppo.ppoLine']),
      signalLine: resolveValue(tokens['chart.ppo.signalLine']),
      histogramPositive: resolveValue(tokens['chart.ppo.histogramPositive']),
      histogramNegative: resolveValue(tokens['chart.ppo.histogramNegative']),
      zeroLine: resolveValue(tokens['chart.ppo.zeroLine']),
    },
    cmo: {
      line: resolveValue(tokens['chart.cmo.line']),
      zone: resolveValue(tokens['chart.cmo.zone']),
    },
    ultimateOsc: {
      line: resolveValue(tokens['chart.ultimateOsc.line']),
      zone: resolveValue(tokens['chart.ultimateOsc.zone']),
    },
    dema: {
      line: resolveValue(tokens['chart.dema.line']),
    },
    tema: {
      line: resolveValue(tokens['chart.tema.line']),
    },
    wma: {
      line: resolveValue(tokens['chart.wma.line']),
    },
    hma: {
      line: resolveValue(tokens['chart.hma.line']),
    },
    pivotPoints: {
      pivot: resolveValue(tokens['chart.pivotPoints.pivot']),
      support: resolveValue(tokens['chart.pivotPoints.support']),
      resistance: resolveValue(tokens['chart.pivotPoints.resistance']),
    },
    fibonacci: {
      level0: resolveValue(tokens['chart.fibonacci.level0']),
      level236: resolveValue(tokens['chart.fibonacci.level236']),
      level382: resolveValue(tokens['chart.fibonacci.level382']),
      level50: resolveValue(tokens['chart.fibonacci.level50']),
      level618: resolveValue(tokens['chart.fibonacci.level618']),
      level786: resolveValue(tokens['chart.fibonacci.level786']),
      level886: resolveValue(tokens['chart.fibonacci.level886']),
      level100: resolveValue(tokens['chart.fibonacci.level100']),
      level127: resolveValue(tokens['chart.fibonacci.level127']),
      level138: resolveValue(tokens['chart.fibonacci.level138']),
      level161: resolveValue(tokens['chart.fibonacci.level161']),
      level200: resolveValue(tokens['chart.fibonacci.level200']),
      level261: resolveValue(tokens['chart.fibonacci.level261']),
      level300: resolveValue(tokens['chart.fibonacci.level300']),
      level361: resolveValue(tokens['chart.fibonacci.level361']),
      level423: resolveValue(tokens['chart.fibonacci.level423']),
    },
    fvg: {
      bullish: resolveValue(tokens['chart.fvg.bullish']),
      bearish: resolveValue(tokens['chart.fvg.bearish']),
      bullishBorder: resolveValue(tokens['chart.fvg.bullishBorder']),
      bearishBorder: resolveValue(tokens['chart.fvg.bearishBorder']),
    },
    liquidityLevels: {
      support: resolveValue(tokens['chart.liquidityLevels.support']),
      resistance: resolveValue(tokens['chart.liquidityLevels.resistance']),
      supportBg: resolveValue(tokens['chart.liquidityLevels.supportBg']),
      resistanceBg: resolveValue(tokens['chart.liquidityLevels.resistanceBg']),
    },
    indicatorZone: resolveValue(tokens['chart.indicator.zone']),
    panel: {
      background: resolveValue(tokens['chart.panel.background']),
      scaleLabel: resolveValue(tokens['chart.panel.scaleLabel']),
      label: resolveValue(tokens['chart.panel.label']),
    },
  };
};

export const getTradingColors = (colorMode: 'light' | 'dark') => {
  const tokens = customConfig.theme?.semanticTokens?.colors || {};

  const resolveValue = (token: unknown): string => {
    if (!token || typeof token !== 'object' || !('value' in token)) return '';
    const tokenValue = (token as { value: string | { base: string; _dark?: string } }).value;
    if (typeof tokenValue === 'string') return tokenValue;
    return colorMode === 'dark' ? (tokenValue._dark || tokenValue.base) : tokenValue.base;
  };

  return {
    profit: resolveValue(tokens['trading.profit']),
    loss: resolveValue(tokens['trading.loss']),
    neutral: resolveValue(tokens['trading.neutral']),
    warning: resolveValue(tokens['trading.warning']),
    info: resolveValue(tokens['trading.info']),
    long: resolveValue(tokens['trading.long']),
    short: resolveValue(tokens['trading.short']),
  };
};

export const getCanvasColors = (colorMode: 'light' | 'dark') => {
  const tokens = customConfig.theme?.semanticTokens?.colors || {};

  const resolveValue = (token: unknown): string => {
    if (!token || typeof token !== 'object' || !('value' in token)) return '';
    const tokenValue = (token as { value: string | { base: string; _dark?: string } }).value;
    if (typeof tokenValue === 'string') return tokenValue;
    return colorMode === 'dark' ? (tokenValue._dark || tokenValue.base) : tokenValue.base;
  };

  return {
    text: resolveValue(tokens['canvas.text']),
    priceTag: {
      bullish: resolveValue(tokens['canvas.priceTag.bullish']),
      bearish: resolveValue(tokens['canvas.priceTag.bearish']),
      info: resolveValue(tokens['canvas.priceTag.info']),
      neutral: resolveValue(tokens['canvas.priceTag.neutral']),
    },
    overlay: {
      dark: resolveValue(tokens['overlay.dark']),
      light: resolveValue(tokens['overlay.light']),
    },
  };
};

export const getPnLColor = (value: number, colorMode: 'light' | 'dark' = 'dark'): string => {
  const colors = getTradingColors(colorMode);
  if (value > 0) return colors.profit;
  if (value < 0) return colors.loss;
  return colors.neutral;
};

export const getSideColor = (side: 'LONG' | 'SHORT' | 'BUY' | 'SELL', colorMode: 'light' | 'dark' = 'dark'): string => {
  const colors = getTradingColors(colorMode);
  return side === 'LONG' || side === 'BUY' ? colors.long : colors.short;
};
