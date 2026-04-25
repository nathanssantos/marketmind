import type { PositionSide } from '@marketmind/types';
export const isDirectionAllowed = (
  directionMode: 'auto' | 'long_only' | 'short_only' | undefined,
  direction: PositionSide,
): boolean => {
  if (directionMode === 'long_only' && direction === 'SHORT') return false;
  if (directionMode === 'short_only' && direction === 'LONG') return false;
  return true;
};
