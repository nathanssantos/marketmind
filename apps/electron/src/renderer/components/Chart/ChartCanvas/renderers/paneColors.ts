export interface PaneSeriesColors {
  outputs: Record<string, string>;
  histogramPositive?: string;
  histogramNegative?: string;
  zeroLine?: string;
}

export const PANE_SERIES_COLORS: Record<string, PaneSeriesColors> = {
  stoch: { outputs: { k: '#2196f3', d: '#ff5722' } },
  stochRsi: { outputs: { k: '#2196f3', d: '#ff9800' } },
  macd: {
    outputs: { line: '#2962ff', signal: '#ff9800' },
    histogramPositive: 'rgba(38, 166, 154, 0.7)',
    histogramNegative: 'rgba(239, 83, 80, 0.7)',
    zeroLine: 'rgba(128, 128, 128, 0.5)',
  },
  ppo: {
    outputs: { line: '#2962ff', signal: '#ff6d00' },
    histogramPositive: 'rgba(38, 166, 154, 0.7)',
    histogramNegative: 'rgba(239, 83, 80, 0.7)',
    zeroLine: 'rgba(128, 128, 128, 0.5)',
  },
  adx: { outputs: { adx: '#7c4dff', plusDI: '#4caf50', minusDI: '#f44336' } },
  aroon: { outputs: { up: '#26a69a', down: '#ef5350', oscillator: 'rgba(128, 128, 128, 0.6)' } },
  elderRay: { outputs: { bullPower: '#26a69a', bearPower: '#ef5350' } },
  klinger: {
    outputs: { kvo: '#2962ff', signal: '#ff6d00' },
    zeroLine: 'rgba(128, 128, 128, 0.5)',
  },
  vortex: { outputs: { viPlus: '#26a69a', viMinus: '#ef5350' } },
  tsi: { outputs: { value: '#2962ff' }, zeroLine: 'rgba(128, 128, 128, 0.5)' },
};

export const PANE_LINE_COLORS: Record<string, string> = {
  rsi: '#2196f3',
  atr: '#ff9800',
  cci: '#ff9800',
  williamsR: '#a855f7',
  mfi: '#9c27b0',
  cmo: '#2196f3',
  roc: '#00bcd4',
  obv: '#2196f3',
  choppiness: '#9e9e9e',
  cmf: '#26a69a',
  ultimateOsc: '#673ab7',
};

export const PANE_ZONE_COLOR = 'rgba(128, 128, 128, 0.7)';
export const PANE_MIDLINE_COLOR = 'rgba(128, 128, 128, 0.4)';
