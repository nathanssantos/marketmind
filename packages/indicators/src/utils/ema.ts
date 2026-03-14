export const emaMultiplier = (period: number): number => 2 / (period + 1);

export const calculateEmaStep = (currentValue: number, previousEma: number, multiplier: number): number =>
  (currentValue - previousEma) * multiplier + previousEma;
