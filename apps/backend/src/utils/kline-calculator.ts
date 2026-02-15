import { BACKFILL_TARGET_KLINES, CHART_INITIAL_KLINES } from '../constants/index';

export const calculateRequiredKlines = (): number => BACKFILL_TARGET_KLINES;

export const calculateChartKlines = (): number => CHART_INITIAL_KLINES;
