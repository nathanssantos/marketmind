import type { MarketType } from '@marketmind/types';
import { createToaster } from '@chakra-ui/react';

export const toaster = createToaster({
  placement: 'bottom-end',
  pauseOnPageIdle: true,
  max: 5,
  overlap: true,
  gap: 16,
  offsets: {
    top: '80px',
    right: '16px',
    bottom: '16px',
    left: '16px',
  },
});

type NavigateToSymbolFn = (symbol: string, marketType?: MarketType) => void;

let navigateToSymbolFn: NavigateToSymbolFn | null = null;

export const setToasterNavigateToSymbol = (fn: NavigateToSymbolFn | null) => {
  navigateToSymbolFn = fn;
};

export const getToasterNavigateToSymbol = () => navigateToSymbolFn;
