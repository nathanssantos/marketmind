import { useMemo } from 'react';
import { useBackendCustomSymbols } from './useBackendCustomSymbols';

export const useIsCustomSymbol = (symbol: string | undefined): boolean => {
  const { customSymbols } = useBackendCustomSymbols();
  return useMemo(() => {
    if (!symbol) return false;
    const upper = symbol.toUpperCase();
    return (customSymbols.data ?? []).some((cs) => cs.symbol.toUpperCase() === upper);
  }, [symbol, customSymbols.data]);
};
