import type { Kline } from '@marketmind/types';

export interface HalvingCycleResult {
  phase: (string | null)[];
  daysFromHalving: (number | null)[];
  cycleProgress: (number | null)[];
}

const BITCOIN_HALVING_DATES = [
  new Date('2012-11-28').getTime(),
  new Date('2016-07-09').getTime(),
  new Date('2020-05-11').getTime(),
  new Date('2024-04-20').getTime(),
  new Date('2028-04-20').getTime(),
];

const DAYS_MS = 24 * 60 * 60 * 1000;
const HALVING_CYCLE_DAYS = 1460;

const getHalvingPhase = (daysFromHalving: number): string => {
  const cycleProgress = (daysFromHalving % HALVING_CYCLE_DAYS) / HALVING_CYCLE_DAYS;

  if (cycleProgress < 0.25) return 'accumulation';
  if (cycleProgress < 0.5) return 'markup';
  if (cycleProgress < 0.75) return 'distribution';
  return 'markdown';
};

const findPreviousHalving = (timestamp: number): number | null => {
  for (let i = BITCOIN_HALVING_DATES.length - 1; i >= 0; i--) {
    if (timestamp >= BITCOIN_HALVING_DATES[i]!) {
      return BITCOIN_HALVING_DATES[i]!;
    }
  }
  return null;
};

export const calculateHalvingCycle = (klines: Kline[]): HalvingCycleResult => {
  const phase: (string | null)[] = [];
  const daysFromHalving: (number | null)[] = [];
  const cycleProgress: (number | null)[] = [];

  for (const kline of klines) {
    const timestamp = kline.openTime;
    const previousHalving = findPreviousHalving(timestamp);

    if (previousHalving === null) {
      phase.push(null);
      daysFromHalving.push(null);
      cycleProgress.push(null);
    } else {
      const daysSinceHalving = Math.floor((timestamp - previousHalving) / DAYS_MS);
      const progress = (daysSinceHalving % HALVING_CYCLE_DAYS) / HALVING_CYCLE_DAYS;
      const currentPhase = getHalvingPhase(daysSinceHalving);

      phase.push(currentPhase);
      daysFromHalving.push(daysSinceHalving);
      cycleProgress.push(progress);
    }
  }

  return { phase, daysFromHalving, cycleProgress };
};
