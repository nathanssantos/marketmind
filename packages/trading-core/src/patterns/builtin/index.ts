import type { PatternDefinition } from '../types';
import { HAMMER } from './hammer';
import { INVERTED_HAMMER } from './inverted-hammer';
import { HANGING_MAN } from './hanging-man';
import { SHOOTING_STAR } from './shooting-star';
import { DOJI } from './doji';
import { DRAGONFLY_DOJI } from './dragonfly-doji';
import { GRAVESTONE_DOJI } from './gravestone-doji';
import { SPINNING_TOP } from './spinning-top';
import { MARUBOZU_WHITE } from './marubozu-white';
import { MARUBOZU_BLACK } from './marubozu-black';
import { BULLISH_ENGULFING } from './bullish-engulfing';
import { BEARISH_ENGULFING } from './bearish-engulfing';
import { BULLISH_HARAMI } from './bullish-harami';
import { BEARISH_HARAMI } from './bearish-harami';
import { PIERCING_LINE } from './piercing-line';
import { DARK_CLOUD_COVER } from './dark-cloud-cover';
import { TWEEZER_BOTTOM } from './tweezer-bottom';
import { TWEEZER_TOP } from './tweezer-top';
import { MORNING_STAR } from './morning-star';
import { EVENING_STAR } from './evening-star';
import { THREE_WHITE_SOLDIERS } from './three-white-soldiers';
import { THREE_BLACK_CROWS } from './three-black-crows';
import { THREE_INSIDE_UP } from './three-inside-up';
import { RISING_THREE_METHODS } from './rising-three-methods';
import { FALLING_THREE_METHODS } from './falling-three-methods';

export const BUILTIN_PATTERNS: readonly PatternDefinition[] = [
  HAMMER,
  INVERTED_HAMMER,
  HANGING_MAN,
  SHOOTING_STAR,
  DOJI,
  DRAGONFLY_DOJI,
  GRAVESTONE_DOJI,
  SPINNING_TOP,
  MARUBOZU_WHITE,
  MARUBOZU_BLACK,
  BULLISH_ENGULFING,
  BEARISH_ENGULFING,
  BULLISH_HARAMI,
  BEARISH_HARAMI,
  PIERCING_LINE,
  DARK_CLOUD_COVER,
  TWEEZER_BOTTOM,
  TWEEZER_TOP,
  MORNING_STAR,
  EVENING_STAR,
  THREE_WHITE_SOLDIERS,
  THREE_BLACK_CROWS,
  THREE_INSIDE_UP,
  RISING_THREE_METHODS,
  FALLING_THREE_METHODS,
] as const;

export const BUILTIN_PATTERN_MAP: Readonly<Record<string, PatternDefinition>> = Object.fromEntries(
  BUILTIN_PATTERNS.map((p) => [p.id, p]),
);

/**
 * Patterns enabled by default on every chart panel of every layout for new
 * users. Kept tight (5 patterns) so the chart doesn't drown in glyphs out of
 * the box — users add more from the popover. See `docs/CANDLE_PATTERNS_PLAN.md`.
 */
export const DEFAULT_ENABLED_PATTERN_IDS: readonly string[] = [
  'hammer',
  'shooting-star',
  'bullish-engulfing',
  'bearish-engulfing',
  'doji',
] as const;
