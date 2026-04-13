import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

interface StrategyJson {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  source?: string;
  status: string;
  enabled: boolean;
  parameters: Record<string, { default: number; min?: number; max?: number; step?: number; description?: string }>;
  indicators: Record<string, { type: string; params: Record<string, string | number> }>;
  entry: {
    long?: ConditionGroup;
    short?: ConditionGroup;
  };
  exit: {
    stopLoss?: { type: string; buffer?: number; indicator?: string; percentage?: number };
    takeProfit: { type: string; multiplier?: number; percentage?: number; indicator?: string; indicatorProperty?: string };
    trailingStop?: { enabled: boolean; type: string; initialMultiplier: number; trailMultiplier: number; breakEvenAfterR?: number };
    conditions?: {
      long?: ConditionGroup;
      short?: ConditionGroup;
    };
  };
  confidence: {
    base: number;
    bonuses: Array<{ condition: Condition; bonus: number; description?: string }>;
    max: number;
  };
  filters?: Record<string, unknown>;
  recommendedTimeframes?: Record<string, unknown>;
  backtestSummary?: Record<string, unknown>;
  education?: Record<string, unknown>;
}

interface ConditionGroup {
  operator: 'AND' | 'OR';
  conditions: Condition[];
}

interface Condition {
  left: string | { calc: string };
  op: string;
  right: string | number | { calc: string };
}

const STRATEGIES_DIR = join(import.meta.dirname, '../strategies/builtin');

const INDICATOR_MAP: Record<string, (name: string, params: Record<string, string>) => string> = {
  sma: (n, p) => {
    const src = p['source'] === 'volume' ? 'volume' : 'close';
    return `${n} = ta.sma(${src}, ${p['period'] ?? '20'})`;
  },
  ema: (n, p) => `${n} = ta.ema(close, ${p['period'] ?? '20'})`,
  rsi: (n, p) => `${n} = ta.rsi(close, ${p['period'] ?? '14'})`,
  atr: (n, p) => `${n} = ta.atr(${p['period'] ?? '14'})`,
  hma: (n, p) => `${n} = ta.hma(close, ${p['period'] ?? '20'})`,
  wma: (n, p) => `${n} = ta.wma(close, ${p['period'] ?? '20'})`,
  cci: (n, p) => `${n} = ta.cci(${p['period'] ?? '14'})`,
  mfi: (n, p) => `${n} = ta.mfi(hlc3, ${p['period'] ?? '14'})`,
  roc: (n, p) => `${n} = ta.roc(close, ${p['period'] ?? '12'})`,
  vwap: (n) => `${n} = ta.vwap(hlc3)`,
  obv: (n, p) => {
    const sma = p['smaPeriod'];
    if (sma) return `${n}_raw = ta.obv()\n${n}_obv = ${n}_raw\n${n}_sma = ta.sma(${n}_raw, ${sma})`;
    return `${n}_obv = ta.obv()`;
  },
  cmo: (n, p) => `${n} = ta.cmo(close, ${p['period'] ?? '14'})`,
  rsi2: (n) => `${n} = ta.rsi(close, 2)`,
  williamsR: (n, p) => `${n} = ta.wpr(${p['period'] ?? '14'})`,
  tsi: (n, p) => `${n}_tsi = ta.tsi(close, ${p['shortPeriod'] ?? '13'}, ${p['longPeriod'] ?? '25'})\n${n}_signal = ta.ema(${n}_tsi, ${p['signalPeriod'] ?? '13'})`,
  ibs: (n) => `${n} = (close - low) / (high - low)`,
  nr7: (n, p) => {
    const lb = p['lookback'] ?? '7';
    return `${n}_range = high - low\n${n}_isNR = true\nfor i = 1 to ${lb} - 1\n    if ${n}_range >= high[i] - low[i]\n        ${n}_isNR := false\n        break\n${n} = ${n}_isNR ? 1 : 0`;
  },

  macd: (n, p) => `[${n}_line, ${n}_signal, ${n}_histogram] = ta.macd(close, ${p['fastPeriod'] ?? '12'}, ${p['slowPeriod'] ?? '26'}, ${p['signalPeriod'] ?? '9'})`,
  bollingerBands: (n, p) => `[${n}_middle, ${n}_upper, ${n}_lower] = ta.bb(close, ${p['period'] ?? '20'}, ${p['stdDev'] ?? '2'})\n${n}_bandwidth = (${n}_upper - ${n}_lower) / ${n}_middle`,
  stochastic: (n, p) => `[${n}_k, _${n}_d, _${n}_unused] = ta.stoch(close, high, low, ${p['period'] ?? '14'}, ${p['smoothK'] ?? '3'}, 3)`,
  keltner: (n, p) => `[${n}_middle, ${n}_upper, ${n}_lower] = ta.kc(close, ${p['period'] ?? p['emaPeriod'] ?? '20'}, ${p['multiplier'] ?? '2'})`,
  donchian: (n, p) => {
    const period = p['period'] ?? '20';
    return `${n}_upper = ta.highest(high, ${period})\n${n}_lower = ta.lowest(low, ${period})\n${n}_middle = (${n}_upper + ${n}_lower) / 2`;
  },
  supertrend: (n, p) => `[${n}_value, ${n}_trend] = ta.supertrend(${p['multiplier'] ?? '3'}, ${p['period'] ?? '10'})`,
  dmi: (n, p) => `[${n}_plusDI, ${n}_minusDI, ${n}_adx] = ta.dmi(${p['period'] ?? '14'}, ${p['period'] ?? '14'})`,
  adx: (n, p) => `[_${n}_plus, _${n}_minus, ${n}_adx] = ta.dmi(${p['period'] ?? '14'}, ${p['period'] ?? '14'})\n${n}_plusDI = _${n}_plus\n${n}_minusDI = _${n}_minus`,
  parabolicSar: (n, p) => `${n} = ta.sar(${p['start'] ?? '0.02'}, ${p['increment'] ?? '0.02'}, ${p['max'] ?? '0.2'})`,

  dema: (n, p) => {
    const period = p['period'] ?? '20';
    return `${n}_e1 = ta.ema(close, ${period})\n${n}_e2 = ta.ema(${n}_e1, ${period})\n${n} = 2 * ${n}_e1 - ${n}_e2`;
  },
  tema: (n, p) => {
    const period = p['period'] ?? '20';
    return `${n}_e1 = ta.ema(close, ${period})\n${n}_e2 = ta.ema(${n}_e1, ${period})\n${n}_e3 = ta.ema(${n}_e2, ${period})\n${n} = 3 * ${n}_e1 - 3 * ${n}_e2 + ${n}_e3`;
  },
  aroon: (n, p) => {
    const period = p['period'] ?? '14';
    return `${n}_up = 100 * (${period} - ta.barssince(high == ta.highest(high, ${period} + 1))) / ${period}\n${n}_down = 100 * (${period} - ta.barssince(low == ta.lowest(low, ${period} + 1))) / ${period}`;
  },
  cmf: (n, p) => {
    const period = p['period'] ?? '20';
    return `${n}_mfv = ((close - low) - (high - close)) / math.max(high - low, 0.0001) * volume\n${n} = ta.sma(${n}_mfv, ${period}) / math.max(ta.sma(volume, ${period}), 1)`;
  },
  ao: (n, p) => {
    const fast = p['fastPeriod'] ?? '5';
    const slow = p['slowPeriod'] ?? '34';
    return `${n} = ta.sma(hl2, ${fast}) - ta.sma(hl2, ${slow})`;
  },
  ppo: (n, p) => {
    const fast = p['fastPeriod'] ?? '12';
    const slow = p['slowPeriod'] ?? '26';
    const sig = p['signalPeriod'] ?? '9';
    return `${n}_fast = ta.ema(close, ${fast})\n${n}_slow = ta.ema(close, ${slow})\n${n}_ppo = (${n}_fast - ${n}_slow) / ${n}_slow * 100\n${n}_signal = ta.ema(${n}_ppo, ${sig})\n${n}_histogram = ${n}_ppo - ${n}_signal`;
  },
  percentB: (n, p) => {
    const period = p['period'] ?? '20';
    const std = p['stdDev'] ?? '2';
    return `[_${n}_m, _${n}_u, _${n}_l] = ta.bb(close, ${period}, ${std})\n${n} = (close - _${n}_l) / math.max(_${n}_u - _${n}_l, 0.0001)`;
  },
  ultimateOscillator: (n, p) => {
    const s = p['shortPeriod'] ?? '7';
    const m = p['mediumPeriod'] ?? '14';
    const l = p['longPeriod'] ?? '28';
    return `${n}_bp = close - math.min(low, close[1])\n${n}_tr = math.max(high, close[1]) - math.min(low, close[1])\n${n}_a1 = math.sum(${n}_bp, ${s}) / math.max(math.sum(${n}_tr, ${s}), 0.0001)\n${n}_a2 = math.sum(${n}_bp, ${m}) / math.max(math.sum(${n}_tr, ${m}), 0.0001)\n${n}_a3 = math.sum(${n}_bp, ${l}) / math.max(math.sum(${n}_tr, ${l}), 0.0001)\n${n} = 100 * (4 * ${n}_a1 + 2 * ${n}_a2 + ${n}_a3) / 7`;
  },
  vortex: (n, p) => {
    const period = p['period'] ?? '14';
    return `${n}_vmp = math.abs(high - low[1])\n${n}_vmm = math.abs(low - high[1])\n${n}_tr = ta.atr(1) * ${period}\n${n}_plus = math.sum(${n}_vmp, ${period}) / math.max(${n}_tr, 0.0001)\n${n}_minus = math.sum(${n}_vmm, ${period}) / math.max(${n}_tr, 0.0001)`;
  },
  klinger: (n, p) => {
    const fast = p['fastPeriod'] ?? '34';
    const slow = p['slowPeriod'] ?? '55';
    const sig = p['signalPeriod'] ?? '13';
    return `${n}_sv = volume * (2 * (close - low) / math.max(high - low, 0.0001) - 1)\n${n}_kvo = ta.ema(${n}_sv, ${fast}) - ta.ema(${n}_sv, ${slow})\n${n}_signal = ta.ema(${n}_kvo, ${sig})`;
  },
  elderRay: (n, p) => {
    const period = p['period'] ?? '13';
    return `${n}_ema = ta.ema(close, ${period})\n${n}_bullPower = high - ${n}_ema\n${n}_bearPower = low - ${n}_ema`;
  },
  massIndex: (n, p) => {
    const ema = p['emaPeriod'] ?? '9';
    const sum = p['sumPeriod'] ?? '25';
    return `${n}_e1 = ta.ema(high - low, ${ema})\n${n}_e2 = ta.ema(${n}_e1, ${ema})\n${n}_ratio = ${n}_e1 / math.max(${n}_e2, 0.0001)\n${n} = math.sum(${n}_ratio, ${sum})`;
  },
  deltaVolume: (n, p) => {
    const period = p['period'] ?? '14';
    return `${n} = close >= open ? volume : -volume\n${n}_ratio = math.sum(${n}, ${period}) / math.max(math.sum(math.abs(${n}), ${period}), 1)`;
  },
  cumulativeRsi: (n, p) => {
    const rsiPeriod = p['rsiPeriod'] ?? '2';
    const sumPeriod = p['sumPeriod'] ?? '3';
    return `${n}_rsi = ta.rsi(close, ${rsiPeriod})\n${n}_cumulative = math.sum(${n}_rsi, ${sumPeriod})`;
  },
  nDayHighLow: (n, p) => {
    const period = p['period'] ?? '20';
    return `${n}_isNDayHigh = high >= ta.highest(high, ${period})\n${n}_isNDayLow = low <= ta.lowest(low, ${period})`;
  },
  highest: (n, p) => {
    const src = p['source'] === 'high' ? 'high' : 'close';
    return `${n} = ta.highest(${src}, ${p['period'] ?? '20'})`;
  },
  lowest: (n, p) => {
    const src = p['source'] === 'low' ? 'low' : 'close';
    return `${n} = ta.lowest(${src}, ${p['period'] ?? '20'})`;
  },
  pivotPoints: (n, p) => {
    const _type = p['type'] ?? 'standard';
    return `${n}_pivot = (high[1] + low[1] + close[1]) / 3\n${n}_r1 = 2 * ${n}_pivot - low[1]\n${n}_s1 = 2 * ${n}_pivot - high[1]\n${n}_r2 = ${n}_pivot + (high[1] - low[1])\n${n}_s2 = ${n}_pivot - (high[1] - low[1])`;
  },
  swingPoints: (n, p) => {
    const lb = p['lookback'] ?? '5';
    return `${n}_high = ta.pivothigh(high, ${lb}, ${lb})\n${n}_low = ta.pivotlow(low, ${lb}, ${lb})`;
  },
  fvg: (n) => `${n}_bullish = low > high[2] ? 1 : 0\n${n}_bearish = high < low[2] ? 1 : 0\n${n}_bullishTop = ${n}_bullish == 1 ? low : na\n${n}_bullishBottom = ${n}_bullish == 1 ? high[2] : na\n${n}_bearishTop = ${n}_bearish == 1 ? low[2] : na\n${n}_bearishBottom = ${n}_bearish == 1 ? high : na`,
  gapDetection: (n, p) => {
    const minPct = p['minPercent'] ?? '1';
    return `${n}_percent = (open - close[1]) / close[1] * 100\n${n}_isGap = math.abs(${n}_percent) >= ${minPct}\n${n}_fillLevel = close[1]`;
  },
  fibonacci: (n) => `${n}_level618 = 0.618\n${n}_level382 = 0.382`,
  relativeStrength: (n, p) => `${n} = ta.rsi(close, ${p['period'] ?? '14'})`,
  fundingRate: (n) => `${n} = 0.0`,
  btcDominance: (n) => `${n}_value = 50.0\n${n}_sma = 50.0`,
  openInterest: (n) => `${n}_change = 0.0\n${n}_sma = 0.0`,
  liquidations: (n) => `${n}_longLiquidations = 0.0\n${n}_shortLiquidations = 0.0`,
};

const resolveParam = (value: string | number, paramNames: Set<string>): string => {
  if (typeof value === 'number') return String(value);
  if (value.startsWith('$')) {
    const paramName = value.slice(1);
    return paramNames.has(paramName) ? paramName : String(value);
  }
  return String(value);
};

const resolveOperand = (
  operand: string | number | { calc: string },
  indicators: Record<string, { type: string; params: Record<string, string | number> }>,
  paramNames: Set<string>
): string => {
  if (typeof operand === 'number') return String(operand);
  if (typeof operand === 'object' && 'calc' in operand) return transpileCalcExpression(operand.calc, indicators, paramNames);

  const str = operand as string;

  if (str.startsWith('$')) return str.slice(1);

  if (str.match(/^\d+(\.\d+)?$/)) return str;

  const priceRefs: Record<string, string> = {
    close: 'close', open: 'open', high: 'high', low: 'low', volume: 'volume',
  };

  const prevMatch = str.match(/^(close|open|high|low|volume)\.prev(\d*)$/);
  if (prevMatch) {
    const offset = prevMatch[2] ? prevMatch[2] : '1';
    return `${prevMatch[1]}[${offset}]`;
  }

  const bracketMatch = str.match(/^(close|open|high|low|volume)\[(\d+)\]$/);
  if (bracketMatch) return str;

  const paramBracketMatch = str.match(/^(close|open|high|low|volume)\[\$(\w+)\]$/);
  if (paramBracketMatch) return `${paramBracketMatch[1]}[${paramBracketMatch[2]}]`;

  if (priceRefs[str]) return priceRefs[str]!;

  if (str === 'volume.sma20') return 'ta.sma(volume, 20)';
  if (str.match(/^volume\.sma\d+$/)) {
    const period = str.replace('volume.sma', '');
    return `ta.sma(volume, ${period})`;
  }

  const indicatorPrevMatch = str.match(/^(\w+)\.prev(\d*)$/);
  if (indicatorPrevMatch) {
    const [, indName, prevOffset] = indicatorPrevMatch;
    const baseVar = resolveIndicatorBase(indName!, indicators);
    return `${baseVar}[${prevOffset || '1'}]`;
  }

  const indicatorPropPrevMatch = str.match(/^(\w+)\.(\w+)\.prev(\d*)$/);
  if (indicatorPropPrevMatch) {
    const [, indName, prop, prevOffset] = indicatorPropPrevMatch;
    const varName = resolveIndicatorProp(indName!, prop!, indicators);
    return `${varName}[${prevOffset || '1'}]`;
  }

  const indicatorPropMatch = str.match(/^(\w+)\.(\w+)$/);
  if (indicatorPropMatch) {
    const [, indName, prop] = indicatorPropMatch;
    if (prop !== 'prev') {
      const varName = resolveIndicatorProp(indName!, prop!, indicators);
      return varName;
    }
  }

  const indicatorPropBracketMatch = str.match(/^(\w+)\.(\w+)\[(\d+)\]$/);
  if (indicatorPropBracketMatch) {
    const [, indName, prop, offset] = indicatorPropBracketMatch;
    const varName = resolveIndicatorProp(indName!, prop!, indicators);
    return `${varName}[${offset}]`;
  }

  const indicatorBracketMatch = str.match(/^(\w+)\[(\d+)\]$/);
  if (indicatorBracketMatch) {
    const [, indName, offset] = indicatorBracketMatch;
    const baseVar = resolveIndicatorBase(indName!, indicators);
    return `${baseVar}[${offset}]`;
  }

  if (str.match(/\*|\+|-|\//)) return transpileCalcExpression(str, indicators, paramNames);

  return resolveIndicatorBase(str, indicators);
};

const resolveIndicatorBase = (
  name: string,
  indicators: Record<string, { type: string; params: Record<string, string | number> }>
): string => {
  const ind = indicators[name];
  if (!ind) return name;

  const multiOutputTypes: Record<string, string> = {
    macd: '_line', bollingerBands: '_middle', stochastic: '_k',
    keltner: '_middle', donchian: '_middle', supertrend: '_value',
    dmi: '_adx', adx: '_adx', tsi: '_tsi', ppo: '_ppo',
    cumulativeRsi: '_cumulative', obv: '_obv',
  };

  const suffix = multiOutputTypes[ind.type];
  return suffix ? `${name}${suffix}` : name;
};

const resolveIndicatorProp = (
  indName: string,
  prop: string,
  indicators: Record<string, { type: string; params: Record<string, string | number> }>
): string => {
  const propMap: Record<string, Record<string, string>> = {
    macd: { line: '_line', macd: '_line', signal: '_signal', histogram: '_histogram' },
    bollingerBands: { upper: '_upper', lower: '_lower', middle: '_middle', bandwidth: '_bandwidth' },
    bb: { upper: '_upper', lower: '_lower', middle: '_middle', bandwidth: '_bandwidth' },
    stochastic: { k: '_k', d: '_d' },
    stoch: { k: '_k', d: '_d' },
    keltner: { upper: '_upper', lower: '_lower', middle: '_middle' },
    donchian: { upper: '_upper', lower: '_lower', middle: '_middle' },
    supertrend: { value: '_value', trend: '_trend' },
    dmi: { adx: '_adx', plusDI: '_plusDI', minusDI: '_minusDI' },
    adx: { adx: '_adx', plusDI: '_plusDI', minusDI: '_minusDI' },
    aroon: { up: '_up', down: '_down' },
    pivotPoints: { pivot: '_pivot', r1: '_r1', r2: '_r2', s1: '_s1', s2: '_s2' },
    pivots: { pivot: '_pivot', r1: '_r1', r2: '_r2', s1: '_s1', s2: '_s2' },
    tsi: { tsi: '_tsi', signal: '_signal' },
    ppo: { ppo: '_ppo', signal: '_signal', histogram: '_histogram' },
    klinger: { kvo: '_kvo', signal: '_signal' },
    vortex: { plus: '_plus', minus: '_minus' },
    elderRay: { bullPower: '_bullPower', bearPower: '_bearPower' },
    obv: { obv: '_obv', sma: '_sma' },
    nDayHighLow: { isNDayHigh: '_isNDayHigh', isNDayLow: '_isNDayLow', high: '_isNDayHigh', low: '_isNDayLow' },
    fvg: { bullish: '_bullish', bearish: '_bearish', bullishTop: '_bullishTop', bullishBottom: '_bullishBottom', bearishTop: '_bearishTop', bearishBottom: '_bearishBottom' },
    gapDetection: { percent: '_percent', fillLevel: '_fillLevel', isGap: '_isGap' },
    gap: { percent: '_percent', fillLevel: '_fillLevel' },
    cumulativeRsi: { cumulative: '_cumulative' },
    liquidations: { longLiquidations: '_longLiquidations', shortLiquidations: '_shortLiquidations' },
  };

  const ind = indicators[indName];
  const type = ind?.type ?? indName;
  const mapping = propMap[type] ?? propMap[indName];
  const suffix = mapping?.[prop];

  return suffix ? `${indName}${suffix}` : `${indName}_${prop}`;
};

const transpileCalcExpression = (
  calc: string,
  indicators: Record<string, { type: string; params: Record<string, string | number> }>,
  paramNames: Set<string>
): string => {
  let result = calc;
  result = result.replace(/\$(\w+)/g, (_match, name) => name);
  result = result.replace(/\babs\(/g, 'math.abs(');
  result = result.replace(/\bmin\(/g, 'math.min(');
  result = result.replace(/\bmax\(/g, 'math.max(');
  for (const [indName, ind] of Object.entries(indicators)) {
    const base = resolveIndicatorBase(indName, indicators);
    if (base !== indName) {
      result = result.replace(new RegExp(`\\b${indName}\\b(?!\\.)`, 'g'), base);
    }
  }
  if (result.includes('volume.sma20')) result = result.replace(/volume\.sma20/g, 'ta.sma(volume, 20)');
  return `(${result})`;
};

const transpileCondition = (
  cond: Condition,
  indicators: Record<string, { type: string; params: Record<string, string | number> }>,
  paramNames: Set<string>
): string => {
  const left = resolveOperand(cond.left, indicators, paramNames);
  const right = resolveOperand(cond.right, indicators, paramNames);

  switch (cond.op) {
    case 'crossover': return `ta.crossover(${left}, ${right})`;
    case 'crossunder': return `ta.crossunder(${left}, ${right})`;
    case '>': return `${left} > ${right}`;
    case '<': return `${left} < ${right}`;
    case '>=': return `${left} >= ${right}`;
    case '<=': return `${left} <= ${right}`;
    case '==': return `${left} == ${right}`;
    case '!=': return `${left} != ${right}`;
    default: return `${left} ${cond.op} ${right}`;
  }
};

const transpileConditionGroup = (
  group: ConditionGroup,
  indicators: Record<string, { type: string; params: Record<string, string | number> }>,
  paramNames: Set<string>
): string => {
  if (!group || !group.conditions || group.conditions.length === 0) return 'false';

  const parts = group.conditions.map((c) => transpileCondition(c, indicators, paramNames));
  const joiner = group.operator === 'OR' ? ' or ' : ' and ';
  return parts.length === 1 ? parts[0]! : `(${parts.join(joiner)})`;
};

const resolveValue = (val: string | number | undefined, fallback: number): string => {
  if (val === undefined) return String(fallback);
  if (typeof val === 'number') return String(val);
  if (val.startsWith('$')) return val.slice(1);
  return val;
};

const transpileStopLoss = (
  sl: StrategyJson['exit']['stopLoss'] | undefined,
  _indicators: Record<string, { type: string; params: Record<string, string | number> }>
): { longSl: string; shortSl: string } => {
  if (!sl) return { longSl: 'close - atrVal * 2', shortSl: 'close + atrVal * 2' };

  if (sl.type === 'percent') {
    const pct = resolveValue(sl.percentage as string | number | undefined, 2);
    return {
      longSl: `close * (1 - ${pct} / 100)`,
      shortSl: `close * (1 + ${pct} / 100)`,
    };
  }

  const buffer = resolveValue(sl.buffer as string | number | undefined, 0.6);
  return {
    longSl: `close - atrVal * ${buffer}`,
    shortSl: `close + atrVal * ${buffer}`,
  };
};

const transpileTakeProfit = (
  tp: StrategyJson['exit']['takeProfit'],
  slExpr: { longSl: string; shortSl: string }
): { longTp: string; shortTp: string } => {
  if (tp.type === 'percent') {
    const pct = resolveValue(tp.percentage as string | number | undefined, 4);
    return {
      longTp: `close * (1 + ${pct} / 100)`,
      shortTp: `close * (1 - ${pct} / 100)`,
    };
  }

  if (tp.type === 'riskReward') {
    const mult = resolveValue(tp.multiplier as string | number | undefined, 2);
    return {
      longTp: `close + math.abs(close - (${slExpr.longSl})) * ${mult}`,
      shortTp: `close - math.abs((${slExpr.shortSl}) - close) * ${mult}`,
    };
  }

  return {
    longTp: `close + atrVal * 4`,
    shortTp: `close - atrVal * 4`,
  };
};

const transpileConfidence = (
  conf: StrategyJson['confidence'],
  indicators: Record<string, { type: string; params: Record<string, string | number> }>,
  paramNames: Set<string>
): string => {
  if (!conf) return '70';

  const lines: string[] = [];
  lines.push(`confBase = ${conf.base}`);

  if (conf.bonuses && conf.bonuses.length > 0) {
    for (let i = 0; i < conf.bonuses.length; i++) {
      const bonus = conf.bonuses[i]!;
      const condExpr = transpileCondition(bonus.condition, indicators, paramNames);
      lines.push(`confBonus${i} = ${condExpr} ? ${bonus.bonus} : 0`);
    }
    const bonusSum = conf.bonuses.map((_, i) => `confBonus${i}`).join(' + ');
    lines.push(`confValue = math.min(confBase + ${bonusSum}, ${conf.max})`);
  } else {
    lines.push(`confValue = confBase`);
  }

  return lines.join('\n');
};

const transpileExitConditions = (
  exitConds: StrategyJson['exit']['conditions'],
  indicators: Record<string, { type: string; params: Record<string, string | number> }>,
  paramNames: Set<string>
): string => {
  if (!exitConds) return 'exitLong = false\nexitShort = false';

  const longExit = exitConds.long ? transpileConditionGroup(exitConds.long, indicators, paramNames) : 'false';
  const shortExit = exitConds.short ? transpileConditionGroup(exitConds.short, indicators, paramNames) : 'false';

  return `exitLong = ${longExit}\nexitShort = ${shortExit}`;
};

const transpileStrategy = (json: StrategyJson): string => {
  const lines: string[] = [];

  lines.push(`// @id ${json.id}`);
  lines.push(`// @name ${json.name}`);
  lines.push(`// @version ${json.version}`);
  lines.push(`// @description ${json.description.replace(/\n/g, ' ')}`);
  lines.push(`// @author ${json.author}`);
  lines.push(`// @tags ${json.tags.join(',')}`);
  if (json.filters) {
    const f = json.filters as Record<string, unknown>;
    if (f['strategyType']) lines.push(`// @strategyType ${f['strategyType']}`);
    if (f['momentumType']) lines.push(`// @momentumType ${f['momentumType']}`);
  }
  for (const [pName, pDef] of Object.entries(json.parameters)) {
    lines.push(`// @param ${pName} ${pDef.description ?? pName}`);
  }
  lines.push('');
  lines.push('//@version=5');
  lines.push(`indicator('${json.name.replace(/'/g, "\\'")}', overlay=true)`);
  lines.push('');

  const paramNames = new Set<string>();
  const indicatorNames = new Set(Object.keys(json.indicators));
  for (const [pName, pDef] of Object.entries(json.parameters)) {
    paramNames.add(pName);
    if (indicatorNames.has(pName)) continue;
    if (typeof pDef.default === 'string') continue;
    const isFloat = !Number.isInteger(pDef.default) || (pDef.step !== undefined && !Number.isInteger(pDef.step));
    const inputFn = isFloat ? 'input.float' : 'input.int';
    const parts = [`${pDef.default}`, `'${pName}'`];
    if (pDef.min !== undefined) parts.push(`minval=${pDef.min}`);
    if (pDef.max !== undefined) parts.push(`maxval=${pDef.max}`);
    if (pDef.step !== undefined) parts.push(`step=${pDef.step}`);
    lines.push(`${pName} = ${inputFn}(${parts.join(', ')})`);
  }
  lines.push('');

  const needsAtr = json.exit.stopLoss?.type === 'swingHighLow' ||
    json.exit.trailingStop?.type === 'atr' ||
    !json.exit.stopLoss ||
    Object.values(json.indicators).some((ind) => ind.type === 'atr');
  const hasAtrIndicator = Object.values(json.indicators).some((ind) => ind.type === 'atr');

  if (needsAtr && !hasAtrIndicator) {
    lines.push('atrVal = ta.atr(14)');
  }

  for (const [indName, indDef] of Object.entries(json.indicators)) {
    const handler = INDICATOR_MAP[indDef.type];
    if (!handler) {
      lines.push(`// TODO: unsupported indicator type '${indDef.type}' for '${indName}'`);
      continue;
    }

    const resolvedParams: Record<string, string> = {};
    for (const [k, v] of Object.entries(indDef.params)) {
      resolvedParams[k] = resolveParam(v, paramNames);
    }

    const code = handler(indName, resolvedParams);
    if (code) {
      lines.push(code);
    }
  }

  if (needsAtr && hasAtrIndicator) {
    const atrName = Object.entries(json.indicators).find(([, v]) => v.type === 'atr')?.[0];
    if (atrName && atrName !== 'atrVal') {
      lines.push(`atrVal = ${atrName}`);
    }
  }

  lines.push('');
  lines.push('volSma20 = ta.sma(volume, 20)');
  lines.push('');

  const longEntry = json.entry.long
    ? transpileConditionGroup(json.entry.long, json.indicators, paramNames)
    : 'false';
  const shortEntry = json.entry.short
    ? transpileConditionGroup(json.entry.short, json.indicators, paramNames)
    : 'false';

  lines.push(`longEntry = ${longEntry}`);
  lines.push(`shortEntry = ${shortEntry}`);
  lines.push('');

  const slExpr = transpileStopLoss(json.exit.stopLoss, json.indicators);
  const tpExpr = transpileTakeProfit(json.exit.takeProfit, slExpr);

  lines.push(transpileConfidence(json.confidence, json.indicators, paramNames));
  lines.push('');

  const exitLines = transpileExitConditions(json.exit.conditions, json.indicators, paramNames);
  lines.push(exitLines);
  lines.push('');

  lines.push('sig = longEntry ? 1 : shortEntry ? -1 : 0');
  lines.push(`sl = longEntry ? ${slExpr.longSl} : shortEntry ? ${slExpr.shortSl} : na`);
  lines.push(`tp = longEntry ? ${tpExpr.longTp} : shortEntry ? ${tpExpr.shortTp} : na`);
  lines.push(`conf = longEntry or shortEntry ? confValue : 0`);
  lines.push(`exitSig = exitLong ? 1 : exitShort ? -1 : 0`);
  lines.push('');

  lines.push("plot(sig, 'signal', display=display.none)");
  lines.push("plot(sl, 'stopLoss', display=display.none)");
  lines.push("plot(tp, 'takeProfit', display=display.none)");
  lines.push("plot(conf, 'confidence', display=display.none)");
  lines.push("plot(exitSig, 'exitSignal', display=display.none)");
  lines.push('');

  return lines.join('\n');
};

const main = () => {
  const args = process.argv.slice(2);
  const singleFile = args[0];

  const files = singleFile
    ? [join(STRATEGIES_DIR, singleFile)]
    : readdirSync(STRATEGIES_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => join(STRATEGIES_DIR, f))
        .sort();

  let success = 0;
  let failed = 0;

  for (const filePath of files) {
    const name = basename(filePath, '.json');
    try {
      const json: StrategyJson = JSON.parse(readFileSync(filePath, 'utf-8'));
      const pine = transpileStrategy(json);
      const outPath = filePath.replace('.json', '.pine');
      writeFileSync(outPath, pine);
      console.log(`OK: ${name}`);
      success++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`FAIL: ${name} - ${msg}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} success, ${failed} failed out of ${files.length}`);
};

main();
