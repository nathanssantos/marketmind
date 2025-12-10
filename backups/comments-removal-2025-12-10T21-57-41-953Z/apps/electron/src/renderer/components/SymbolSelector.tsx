import { Box, Flex, IconButton, Input, Spinner, Text, VStack } from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCoins } from 'react-icons/lu';
import { useSymbolSearch } from '../hooks/useSymbolSearch';
import type { MarketDataService } from '../services/market/MarketDataService';
import { MarketDataService as MarketDataServiceClass } from '../services/market/MarketDataService';
import { BinanceProvider } from '../services/market/providers/BinanceProvider';
import { Popover } from './ui/popover';
import { TooltipWrapper } from './ui/Tooltip';

interface SymbolSelectorProps {
  marketService?: MarketDataService;
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

const createDefaultMarketService = (): MarketDataService => {
  const binance = new BinanceProvider();
  return new MarketDataServiceClass({
    primaryProvider: binance,
    fallbackProviders: [],
    enableCache: true,
    cacheDuration: 60 * 1000,
  });
};

export function SymbolSelector({ marketService: providedMarketService, value, onChange }: SymbolSelectorProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const marketService = useMemo(() => providedMarketService || createDefaultMarketService(), [providedMarketService]);

  const { symbols, loading, search } = useSymbolSearch(marketService, {
    minQueryLength: 2,
    debounceMs: 300,
  });

  const displaySymbols = useMemo(() => {
    return searchQuery.length >= 2 ? symbols : POPULAR_SYMBOLS;
  }, [searchQuery, symbols]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    search(query);
  };

  const selectedSymbol = POPULAR_SYMBOLS.find(s => s.symbol === value);
  const currentSymbol = selectedSymbol?.baseAsset || value.replace('USDT', '');

  const handleSelect = (symbol: string) => {
    onChange(symbol);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(e) => setIsOpen(e.open)}
      showArrow={false}
      width="320px"
      positioning={{ placement: 'bottom-start', offset: { mainAxis: 8 } }}
      trigger={
        <Flex align="center" gap={2}>
          <TooltipWrapper label={t('symbolSelector.label')} showArrow isDisabled={isOpen}>
            <IconButton
              aria-label={t('symbolSelector.label')}
              size="2xs"
              variant="solid"
              colorPalette="blue"
            >
              <LuCoins />
            </IconButton>
          </TooltipWrapper>
          <Text fontSize="xs" fontWeight="semibold" color="fg">
            {currentSymbol}
          </Text>
        </Flex>
      }
    >
      <Flex direction="column" maxH="400px">
        <Box p={2} borderBottomWidth="1px" borderColor="border" flexShrink={0}>
          <Input
            placeholder={t('symbolSelector.searchPlaceholder')}
            value={searchQuery}
            onChange={handleSearchChange}
            size="xs"
            bg="bg.muted"
            borderColor="border"
            _focus={{ borderColor: 'blue.500' }}
            autoFocus
            px={3}
          />
        </Box>

        <Box overflowY="auto" flex={1}>
          {loading && (
            <Flex align="center" justify="center" py={4}>
              <Spinner size="sm" />
            </Flex>
          )}

          {!loading && displaySymbols.length === 0 && (
            <Box p={4} textAlign="center">
              <Text color="fg.muted" fontSize="xs">
                {searchQuery.length >= 2 ? t('symbolSelector.noSymbolsFound') : t('common.typeToSearch')}
              </Text>
            </Box>
          )}

          {!loading && displaySymbols.length > 0 && (
            <VStack gap={0} align="stretch">
              {displaySymbols.slice(0, 20).map((symbol) => (
                <Box
                  key={symbol.symbol}
                  px={3}
                  py={2}
                  cursor="pointer"
                  bg={value === symbol.symbol ? 'bg.muted' : 'transparent'}
                  _hover={{ bg: 'bg.muted' }}
                  onClick={() => handleSelect(symbol.symbol)}
                  borderBottomWidth="1px"
                  borderColor="border"
                >
                  <Text fontWeight={value === symbol.symbol ? 'semibold' : 'medium'} fontSize="xs" color="fg">
                    {symbol.displayName}
                  </Text>
                  <Text fontSize="2xs" color="fg.muted">
                    {symbol.symbol}
                  </Text>
                </Box>
              ))}
            </VStack>
          )}
        </Box>
      </Flex>
    </Popover>
  );
}