import * as fs from 'fs';
import * as path from 'path';
import type {
  SetupVolumeType,
  SetupStrategyType,
  SetupMomentumType,
} from '@marketmind/types';
import { logger } from '../../services/logger';

interface StrategyFilterTypes {
  volumeType: SetupVolumeType;
  strategyType: SetupStrategyType;
  momentumType: SetupMomentumType;
}

const DEFAULT_FILTER_TYPES: StrategyFilterTypes = {
  volumeType: 'ANY',
  strategyType: 'ANY',
  momentumType: 'ANY',
};

const FALLBACK_FILTER_TYPES: Record<string, StrategyFilterTypes> = {
  'breakout-long': { volumeType: 'BREAKOUT', strategyType: 'TREND_FOLLOWING', momentumType: 'BREAKOUT' },
  'breakout-short': { volumeType: 'BREAKOUT', strategyType: 'TREND_FOLLOWING', momentumType: 'BREAKOUT' },
  'trend-continuation': { volumeType: 'PULLBACK', strategyType: 'TREND_FOLLOWING', momentumType: 'PULLBACK' },
  'oversold-bounce': { volumeType: 'REVERSAL', strategyType: 'MEAN_REVERSION', momentumType: 'REVERSAL' },
  'overbought-fade': { volumeType: 'REVERSAL', strategyType: 'MEAN_REVERSION', momentumType: 'REVERSAL' },
  'support-bounce': { volumeType: 'REVERSAL', strategyType: 'MEAN_REVERSION', momentumType: 'REVERSAL' },
  'resistance-fade': { volumeType: 'REVERSAL', strategyType: 'MEAN_REVERSION', momentumType: 'REVERSAL' },
  'ema9-pullback': { volumeType: 'PULLBACK', strategyType: 'TREND_FOLLOWING', momentumType: 'PULLBACK' },
  'ema9-double-pullback': { volumeType: 'PULLBACK', strategyType: 'TREND_FOLLOWING', momentumType: 'PULLBACK' },
  'ema9-continuation': { volumeType: 'PULLBACK', strategyType: 'TREND_FOLLOWING', momentumType: 'PULLBACK' },
};

const filterTypesCache = new Map<string, StrategyFilterTypes>();
let cacheInitialized = false;

const STRATEGIES_PATHS = [
  path.join(process.cwd(), 'strategies', 'builtin'),
  path.join(process.cwd(), 'strategies', 'custom'),
];

const loadStrategiesFilterTypes = (): void => {
  if (cacheInitialized) return;

  for (const [id, types] of Object.entries(FALLBACK_FILTER_TYPES)) {
    filterTypesCache.set(id, types);
  }

  for (const basePath of STRATEGIES_PATHS) {
    if (!fs.existsSync(basePath)) continue;

    try {
      const files = fs.readdirSync(basePath);
      for (const file of files) {
        if (!file.endsWith('.pine')) continue;

        try {
          const filePath = path.join(basePath, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const id = file.replace('.pine', '');

          let strategyType: string = 'ANY';
          let momentumType: string = 'ANY';
          let volumeType: string = 'ANY';

          for (const line of content.split('\n')) {
            if (!line.startsWith('//')) break;
            const match = line.match(/^\/\/\s*@(\w+)\s+(.+)$/);
            if (!match) continue;
            const idMatch = line.match(/^\/\/\s*@id\s+(.+)$/);
            if (idMatch) { filterTypesCache.set(idMatch[1]!.trim(), { volumeType: volumeType as SetupVolumeType, strategyType: strategyType as SetupStrategyType, momentumType: momentumType as SetupMomentumType }); }
            if (match[1] === 'strategyType') strategyType = match[2]!.trim();
            if (match[1] === 'momentumType') momentumType = match[2]!.trim();
            if (match[1] === 'volumeType') volumeType = match[2]!.trim();
          }

          filterTypesCache.set(id, {
            volumeType: volumeType as SetupVolumeType,
            strategyType: strategyType as SetupStrategyType,
            momentumType: momentumType as SetupMomentumType,
          });
        } catch (err) {
          logger.trace({ file, error: err }, 'Failed to parse Pine strategy file for filter types');
        }
      }
    } catch (err) {
      logger.trace({ basePath, error: err }, 'Failed to read strategies directory');
    }
  }

  cacheInitialized = true;
};

export const getStrategyVolumeType = (setupType: string): SetupVolumeType => {
  loadStrategiesFilterTypes();
  return filterTypesCache.get(setupType)?.volumeType ?? DEFAULT_FILTER_TYPES.volumeType;
};

export const getStrategyStrategyType = (setupType: string): SetupStrategyType => {
  loadStrategiesFilterTypes();
  return filterTypesCache.get(setupType)?.strategyType ?? DEFAULT_FILTER_TYPES.strategyType;
};

export const getStrategyMomentumType = (setupType: string): SetupMomentumType => {
  loadStrategiesFilterTypes();
  return filterTypesCache.get(setupType)?.momentumType ?? DEFAULT_FILTER_TYPES.momentumType;
};

export const getStrategyFilterTypes = (setupType: string): StrategyFilterTypes => {
  loadStrategiesFilterTypes();
  return filterTypesCache.get(setupType) ?? DEFAULT_FILTER_TYPES;
};

export const refreshFilterTypesCache = (): void => {
  filterTypesCache.clear();
  cacheInitialized = false;
  loadStrategiesFilterTypes();
};

export const getLoadedFilterTypesCount = (): number => {
  loadStrategiesFilterTypes();
  return filterTypesCache.size;
};
