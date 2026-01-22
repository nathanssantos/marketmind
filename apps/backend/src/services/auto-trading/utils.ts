import type { Interval } from '@marketmind/types';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AUTO_TRADING_ROTATION, INTERVAL_MS, TIME_MS } from '../../constants';
import { getIntervalMs } from '../dynamic-symbol-rotation';
import { serializeError } from '../../utils/errors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, '../../../logs/auto-trading.log');

const ensureLogDir = (): void => {
  const logDir = path.dirname(LOG_FILE);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
};

export const log = (message: string, data?: Record<string, unknown>): void => {
  const timestamp = new Date().toISOString();
  const logLine = data
    ? `[${timestamp}] ${message} ${JSON.stringify(data)}`
    : `[${timestamp}] ${message}`;

  console.log(`[Auto-Trading] ${logLine}`);

  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, `${logLine}\n`);
  } catch (error) {
    console.error('[Auto-Trading] Failed to write to log file:', serializeError(error));
  }
};

export const yieldToEventLoop = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

export const getPollingIntervalForTimeframe = (interval: string): number => {
  const intervalMs = INTERVAL_MS[interval as Interval];
  if (!intervalMs) {
    log(`⚠️ Unknown interval ${interval}, defaulting to 1 minute polling`);
    return TIME_MS.MINUTE;
  }
  return Math.max(intervalMs, TIME_MS.MINUTE);
};

const MIN_ROTATION_ANTICIPATION_MS = AUTO_TRADING_ROTATION.MIN_ANTICIPATION_MS;
const MAX_ROTATION_ANTICIPATION_MS = AUTO_TRADING_ROTATION.MAX_ANTICIPATION_MS;

export const getRotationAnticipationMs = (interval: string): number => {
  const intervalMs = INTERVAL_MS[interval as Interval] ?? TIME_MS.HOUR;
  const anticipation = Math.floor(intervalMs * 0.05);
  return Math.max(MIN_ROTATION_ANTICIPATION_MS, Math.min(anticipation, MAX_ROTATION_ANTICIPATION_MS));
};

export const getCandleCloseTime = (interval: string, timestamp: number = Date.now()): number => {
  const intervalMs = getIntervalMs(interval);
  const candleOpenTime = Math.floor(timestamp / intervalMs) * intervalMs;
  return candleOpenTime + intervalMs;
};

export const getNextCandleCloseTime = (interval: string, timestamp: number = Date.now()): number => {
  return getCandleCloseTime(interval, timestamp) + getIntervalMs(interval);
};
