import { Select, type SelectOption } from '@/renderer/components/ui/select';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSymbolSearch } from '../hooks/useSymbolSearch';
import type { MarketDataService } from '../services/market/MarketDataService';

interface SymbolSelectorProps {
  marketService: MarketDataService;
  value: string;
  onChange: (symbol: string) => void;
}

const POPULAR_SYMBOLS = [
  { symbol: 'BTCUSDT', displayName: 'Bitcoin / USDT', baseAsset: 'BTC', quoteAsset: 'USDT' },
  { symbol: 'ETHUSDT', displayName: 'Ethereum / USDT', baseAsset: 'ETH', quoteAsset: 'USDT' },
  { symbol: 'BNBUSDT', displayName: 'BNB / USDT', baseAsset: 'BNB', quoteAsset: 'USDT' },
  { symbol: 'SOLUSDT', displayName: 'Solana / USDT', baseAsset: 'SOL', quoteAsset: 'USDT' },
  { symbol: 'ADAUSDT', displayName: 'Cardano / USDT', baseAsset: 'ADA', quoteAsset: 'USDT' },
  { symbol: 'XRPUSDT', displayName: 'XRP / USDT', baseAsset: 'XRP', quoteAsset: 'USDT' },
  { symbol: 'DOGEUSDT', displayName: 'Dogecoin / USDT', baseAsset: 'DOGE', quoteAsset: 'USDT' },
  { symbol: 'DOTUSDT', displayName: 'Polkadot / USDT', baseAsset: 'DOT', quoteAsset: 'USDT' },
];

export function SymbolSelector({ marketService, value, onChange }: SymbolSelectorProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { symbols, loading } = useSymbolSearch(marketService, {
    minQueryLength: 2,
    debounceMs: 300,
  });

  const options: SelectOption[] = useMemo(() => {
    const displaySymbols = searchQuery.length >= 2 ? symbols : POPULAR_SYMBOLS;
    
    return displaySymbols.slice(0, 20).map((symbol) => ({
      value: symbol.symbol,
      label: symbol.displayName,
      description: symbol.symbol,
    }));
  }, [searchQuery, symbols]);

  const selectedSymbol = POPULAR_SYMBOLS.find(s => s.symbol === value);

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      placeholder={selectedSymbol?.displayName || value}
      enableSearch
      label={t('symbolSelector.label')}
      onSearchChange={setSearchQuery}
      searchPlaceholder={t('symbolSelector.searchPlaceholder')}
      isLoading={loading}
      emptyMessage={searchQuery.length >= 2 ? t('symbolSelector.noSymbolsFound') : t('common.typeToSearch')}
      sectionLabel={searchQuery.length < 2 ? t('symbolSelector.popularSymbols') : undefined}
      minWidth="280px"
    />
  );
}

