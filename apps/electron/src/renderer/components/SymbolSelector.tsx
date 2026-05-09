import { Badge, Button, CryptoIcon, Input, Popover } from '@renderer/components/ui';
import { Box, Flex, Spinner, Text, VStack } from '@chakra-ui/react';
import type { AssetClass, MarketType } from '@marketmind/types';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuBuilding2, LuCoins, LuSettings } from 'react-icons/lu';
import { useActiveChartSymbols } from '../hooks/useActiveChartSymbols';
import { useActiveWallet } from '../hooks/useActiveWallet';
import { useBackendCustomSymbols } from '../hooks/useBackendCustomSymbols';
import { useBackendKlines } from '../hooks/useBackendKlines';
import { useDisclosure } from '../hooks/useDisclosure';
import { trpc } from '../utils/trpc';
import { CustomSymbolsDialog } from './CustomSymbols/CustomSymbolsDialog';

interface SymbolSelectorProps {
  value: string;
  onChange: (symbol: string, marketType?: MarketType, assetClass?: AssetClass) => void;
  marketType?: MarketType;
  onMarketTypeChange?: (marketType: MarketType) => void;
  assetClass?: AssetClass;
  onAssetClassChange?: (assetClass: AssetClass) => void;
  showMarketTypeToggle?: boolean;
  showAssetClassToggle?: boolean;
}

interface SymbolInfo {
  symbol: string;
  displayName: string;
  baseAsset: string;
  quoteAsset: string;
}

const POPULAR_SPOT_SYMBOLS: SymbolInfo[] = [
  { symbol: 'BTCUSDT', displayName: 'Bitcoin / USDT', baseAsset: 'BTC', quoteAsset: 'USDT' },
  { symbol: 'ETHUSDT', displayName: 'Ethereum / USDT', baseAsset: 'ETH', quoteAsset: 'USDT' },
  { symbol: 'XRPUSDT', displayName: 'XRP / USDT', baseAsset: 'XRP', quoteAsset: 'USDT' },
  { symbol: 'BNBUSDT', displayName: 'BNB / USDT', baseAsset: 'BNB', quoteAsset: 'USDT' },
  { symbol: 'SOLUSDT', displayName: 'Solana / USDT', baseAsset: 'SOL', quoteAsset: 'USDT' },
  { symbol: 'DOGEUSDT', displayName: 'Dogecoin / USDT', baseAsset: 'DOGE', quoteAsset: 'USDT' },
  { symbol: 'ADAUSDT', displayName: 'Cardano / USDT', baseAsset: 'ADA', quoteAsset: 'USDT' },
  { symbol: 'LINKUSDT', displayName: 'Chainlink / USDT', baseAsset: 'LINK', quoteAsset: 'USDT' },
  { symbol: 'AVAXUSDT', displayName: 'Avalanche / USDT', baseAsset: 'AVAX', quoteAsset: 'USDT' },
  { symbol: 'DOTUSDT', displayName: 'Polkadot / USDT', baseAsset: 'DOT', quoteAsset: 'USDT' },
  { symbol: 'NEARUSDT', displayName: 'NEAR Protocol / USDT', baseAsset: 'NEAR', quoteAsset: 'USDT' },
  { symbol: 'PENDLEUSDT', displayName: 'Pendle / USDT', baseAsset: 'PENDLE', quoteAsset: 'USDT' },
];

const POPULAR_FUTURES_SYMBOLS: SymbolInfo[] = [
  { symbol: 'BTCUSDT', displayName: 'Bitcoin / USDT', baseAsset: 'BTC', quoteAsset: 'USDT' },
  { symbol: 'ETHUSDT', displayName: 'Ethereum / USDT', baseAsset: 'ETH', quoteAsset: 'USDT' },
  { symbol: 'XRPUSDT', displayName: 'XRP / USDT', baseAsset: 'XRP', quoteAsset: 'USDT' },
  { symbol: 'BNBUSDT', displayName: 'BNB / USDT', baseAsset: 'BNB', quoteAsset: 'USDT' },
  { symbol: 'SOLUSDT', displayName: 'Solana / USDT', baseAsset: 'SOL', quoteAsset: 'USDT' },
  { symbol: 'DOGEUSDT', displayName: 'Dogecoin / USDT', baseAsset: 'DOGE', quoteAsset: 'USDT' },
  { symbol: 'ADAUSDT', displayName: 'Cardano / USDT', baseAsset: 'ADA', quoteAsset: 'USDT' },
  { symbol: 'LINKUSDT', displayName: 'Chainlink / USDT', baseAsset: 'LINK', quoteAsset: 'USDT' },
  { symbol: 'AVAXUSDT', displayName: 'Avalanche / USDT', baseAsset: 'AVAX', quoteAsset: 'USDT' },
  { symbol: 'DOTUSDT', displayName: 'Polkadot / USDT', baseAsset: 'DOT', quoteAsset: 'USDT' },
  { symbol: 'NEARUSDT', displayName: 'NEAR Protocol / USDT', baseAsset: 'NEAR', quoteAsset: 'USDT' },
  { symbol: 'PENDLEUSDT', displayName: 'Pendle / USDT', baseAsset: 'PENDLE', quoteAsset: 'USDT' },
];

const POPULAR_STOCK_SYMBOLS: SymbolInfo[] = [
  { symbol: 'AAPL', displayName: 'Apple Inc', baseAsset: 'AAPL', quoteAsset: 'USD' },
  { symbol: 'MSFT', displayName: 'Microsoft Corp', baseAsset: 'MSFT', quoteAsset: 'USD' },
  { symbol: 'GOOGL', displayName: 'Alphabet Inc', baseAsset: 'GOOGL', quoteAsset: 'USD' },
  { symbol: 'AMZN', displayName: 'Amazon.com Inc', baseAsset: 'AMZN', quoteAsset: 'USD' },
  { symbol: 'NVDA', displayName: 'NVIDIA Corp', baseAsset: 'NVDA', quoteAsset: 'USD' },
  { symbol: 'META', displayName: 'Meta Platforms Inc', baseAsset: 'META', quoteAsset: 'USD' },
  { symbol: 'TSLA', displayName: 'Tesla Inc', baseAsset: 'TSLA', quoteAsset: 'USD' },
  { symbol: 'JPM', displayName: 'JPMorgan Chase', baseAsset: 'JPM', quoteAsset: 'USD' },
  { symbol: 'V', displayName: 'Visa Inc', baseAsset: 'V', quoteAsset: 'USD' },
  { symbol: 'SPY', displayName: 'SPDR S&P 500 ETF', baseAsset: 'SPY', quoteAsset: 'USD' },
  { symbol: 'QQQ', displayName: 'Invesco QQQ Trust', baseAsset: 'QQQ', quoteAsset: 'USD' },
  { symbol: 'DIA', displayName: 'SPDR Dow Jones ETF', baseAsset: 'DIA', quoteAsset: 'USD' },
];

const useOpenPositionSymbols = (walletId: string | undefined) => {
  const { data: tradeExecutions } = trpc.trading.getTradeExecutions.useQuery(
    { walletId: walletId ?? '', limit: 100 },
    { enabled: !!walletId }
  );

  const { data: activeExecutions } = trpc.autoTrading.getActiveExecutions.useQuery(
    { walletId: walletId ?? '' },
    { enabled: !!walletId }
  );

  return useMemo(() => {
    const symbols = new Set<string>();

    tradeExecutions
      ?.filter((e) => e.status === 'open' || e.status === 'pending')
      .forEach((e) => symbols.add(e.symbol));

    activeExecutions
      ?.filter((e) => e.status === 'open' || e.status === 'pending')
      .forEach((e) => symbols.add(e.symbol));

    return symbols;
  }, [tradeExecutions, activeExecutions]);
};

export function SymbolSelector({
  value,
  onChange,
  marketType: externalMarketType,
  onMarketTypeChange,
  assetClass: externalAssetClass,
  onAssetClassChange,
  showMarketTypeToggle = false,
  showAssetClassToggle = false,
}: SymbolSelectorProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const customSymbolsManage = useDisclosure();
  const [searchQuery, setSearchQuery] = useState('');
  const [internalMarketType, setInternalMarketType] = useState<MarketType>('FUTURES');
  const [internalAssetClass, setInternalAssetClass] = useState<AssetClass>('CRYPTO');

  const { activeWalletId } = useActiveWallet();
  const openPositionSymbols = useOpenPositionSymbols(activeWalletId ?? undefined);
  const activeChartSymbols = useActiveChartSymbols();
  const { customSymbols: customSymbolsQuery } = useBackendCustomSymbols();

  const marketType = externalMarketType ?? internalMarketType;
  const assetClass = externalAssetClass ?? internalAssetClass;
  const isFutures = marketType === 'FUTURES';
  const isStocks = assetClass === 'STOCKS';

  const getPopularSymbols = () => {
    if (isStocks) return POPULAR_STOCK_SYMBOLS;
    return isFutures ? POPULAR_FUTURES_SYMBOLS : POPULAR_SPOT_SYMBOLS;
  };
  const popularSymbols = getPopularSymbols();

  const { useSearchSymbols } = useBackendKlines();
  const searchResult = useSearchSymbols(searchQuery, marketType, assetClass);

  const isSearching = searchQuery.length >= 2;

  const displaySymbols: SymbolInfo[] = useMemo(() => {
    if (isSearching && searchResult.data) {
      const results: SymbolInfo[] = isFutures
        ? searchResult.data.map((s: SymbolInfo) => ({ ...s, displayName: `${s.displayName} FUTURES` }))
        : searchResult.data;
      return [...results].sort((a, b) => {
        const aOpen = openPositionSymbols.has(a.symbol) ? 0 : 1;
        const bOpen = openPositionSymbols.has(b.symbol) ? 0 : 1;
        return aOpen - bOpen;
      });
    }
    return popularSymbols;
  }, [isSearching, searchResult.data, popularSymbols, isFutures, openPositionSymbols]);

  const openPositionItems = useMemo(() => {
    if (isSearching) return [];
    const allSymbols = isFutures ? POPULAR_FUTURES_SYMBOLS : isStocks ? POPULAR_STOCK_SYMBOLS : POPULAR_SPOT_SYMBOLS;
    const symbolMap = new Map(allSymbols.map(s => [s.symbol, s]));

    const items: SymbolInfo[] = [];
    for (const sym of openPositionSymbols) {
      const known = symbolMap.get(sym);
      if (known) {
        items.push(known);
      } else {
        const baseAsset = isStocks ? sym : sym.replace('USDT', '');
        const quoteAsset = isStocks ? 'USD' : 'USDT';
        items.push({
          symbol: sym,
          displayName: isStocks ? sym : `${baseAsset} / ${quoteAsset}`,
          baseAsset,
          quoteAsset,
        });
      }
    }
    return items;
  }, [isSearching, openPositionSymbols, isFutures, isStocks]);

  const activeChartItems = useMemo(() => {
    if (isSearching) return [];
    const allSymbols = isFutures ? POPULAR_FUTURES_SYMBOLS : isStocks ? POPULAR_STOCK_SYMBOLS : POPULAR_SPOT_SYMBOLS;
    const symbolMap = new Map(allSymbols.map(s => [s.symbol, s]));

    const items: SymbolInfo[] = [];
    for (const sym of activeChartSymbols) {
      if (sym === value || openPositionSymbols.has(sym)) continue;
      const known = symbolMap.get(sym);
      if (known) {
        items.push(known);
      } else {
        const baseAsset = isStocks ? sym : sym.replace('USDT', '');
        const quoteAsset = isStocks ? 'USD' : 'USDT';
        items.push({
          symbol: sym,
          displayName: isStocks ? sym : `${baseAsset} / ${quoteAsset}`,
          baseAsset,
          quoteAsset,
        });
      }
    }
    return items;
  }, [isSearching, activeChartSymbols, value, openPositionSymbols, isFutures, isStocks]);

  const filteredPopularSymbols = useMemo(() => {
    if (isSearching || (openPositionItems.length === 0 && activeChartItems.length === 0)) return displaySymbols;
    const excludeSet = new Set([...openPositionSymbols, ...activeChartSymbols]);
    return displaySymbols.filter((s: SymbolInfo) => !excludeSet.has(s.symbol));
  }, [isSearching, displaySymbols, openPositionSymbols, openPositionItems.length, activeChartSymbols, activeChartItems.length]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleMarketTypeToggle = (newType: MarketType) => {
    if (onMarketTypeChange) {
      onMarketTypeChange(newType);
    } else {
      setInternalMarketType(newType);
    }
    setSearchQuery('');
  };

  const handleAssetClassToggle = (newClass: AssetClass) => {
    if (onAssetClassChange) {
      onAssetClassChange(newClass);
    } else {
      setInternalAssetClass(newClass);
    }
    setSearchQuery('');
  };

  const selectedSymbol = popularSymbols.find(s => s.symbol === value);
  const currentSymbol = selectedSymbol?.baseAsset ?? (isStocks ? value : value.replace('USDT', ''));

  const handleSelect = (symbol: string, overrides?: { marketType?: MarketType; assetClass?: AssetClass }) => {
    onChange(symbol, overrides?.marketType ?? marketType, overrides?.assetClass ?? assetClass);
    setIsOpen(false);
    setSearchQuery('');
  };

  const renderSymbolRow = (symbol: SymbolInfo, hasOpenPosition: boolean) => (
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
      <Flex align="center" justify="space-between">
        <Flex align="center" gap={2}>
          {isStocks ? (
            <Flex
              align="center"
              justify="center"
              w="20px"
              h="20px"
              borderRadius="md"
              bg="green.subtle"
              color="green.fg"
            >
              <LuBuilding2 size={12} />
            </Flex>
          ) : (
            <CryptoIcon symbol={symbol.symbol} size={20} />
          )}
          <Flex direction="column">
            <Text fontWeight={value === symbol.symbol ? 'semibold' : 'medium'} fontSize="xs" color="fg">
              {isStocks ? symbol.symbol : `${symbol.baseAsset}/${symbol.quoteAsset}`}
            </Text>
            <Text fontSize="2xs" color="fg.muted">
              {symbol.displayName}
            </Text>
          </Flex>
        </Flex>
        <Flex align="center" gap={1}>
          {hasOpenPosition && isSearching && (
            <Box w="6px" h="6px" borderRadius="full" bg="green.fg" />
          )}
          <Badge
            size="xs"
            colorPalette={isStocks ? 'green' : isFutures ? 'orange' : 'blue'}
            variant="subtle"
            px={2}
          >
            {isStocks ? 'STK' : isFutures ? 'FUT' : 'SPOT'}
          </Badge>
        </Flex>
      </Flex>
    </Box>
  );

  const renderSectionHeader = (label: string) => (
    <Box px={3} py={1.5} bg="bg.subtle">
      <Text fontSize="2xs" fontWeight="semibold" color="fg.muted" letterSpacing="wide">
        {label}
      </Text>
    </Box>
  );

  const totalItems = isSearching
    ? displaySymbols.length
    : openPositionItems.length + activeChartItems.length + filteredPopularSymbols.length;

  return (
    <>
    <Popover
      open={isOpen}
      onOpenChange={(e) => setIsOpen(e.open)}
      showArrow={false}
      width="320px"
      positioning={{ placement: 'bottom-start', offset: { mainAxis: 8 } }}
      trigger={
        <Button
          aria-label={t('symbolSelector.label')}
          size="2xs"
          variant="outline"
          color="fg.muted"
        >
          <CryptoIcon symbol={value} size={12} />
          {currentSymbol}
        </Button>
      }
    >
      <Flex direction="column" maxH="400px">
        {showAssetClassToggle && (
          <Flex p={2} gap={1} borderBottomWidth="1px" borderColor="border" flexShrink={0}>
            <Button
              size="2xs"
              variant="outline"
              color={!isStocks ? 'trading.info' : 'fg.muted'}
              onClick={() => handleAssetClassToggle('CRYPTO')}
              flex={1}
            >
              <LuCoins />
              {t('symbolSelector.crypto')}
            </Button>
            <Button
              size="2xs"
              variant="outline"
              color={isStocks ? 'trading.profit' : 'fg.muted'}
              onClick={() => handleAssetClassToggle('STOCKS')}
              flex={1}
            >
              <LuBuilding2 />
              {t('symbolSelector.stocks')}
            </Button>
          </Flex>
        )}
        {showMarketTypeToggle && !isStocks && (
          <Flex p={2} gap={1} borderBottomWidth="1px" borderColor="border" flexShrink={0}>
            <Button
              size="2xs"
              variant="outline"
              color={!isFutures ? 'trading.info' : 'fg.muted'}
              onClick={() => handleMarketTypeToggle('SPOT')}
              flex={1}
            >
              Spot
            </Button>
            <Button
              size="2xs"
              variant="outline"
              color={isFutures ? 'trading.warning' : 'fg.muted'}
              onClick={() => handleMarketTypeToggle('FUTURES')}
              flex={1}
            >
              Futures
            </Button>
          </Flex>
        )}
        <Box p={2} borderBottomWidth="1px" borderColor="border" flexShrink={0}>
          <Input
            placeholder={t('symbolSelector.searchPlaceholder')}
            value={searchQuery}
            onChange={handleSearchChange}
            size="xs"
            bg="bg.muted"
            borderColor="border"
            _focus={{ borderColor: 'accent.solid' }}
            autoFocus
            px={3}
          />
        </Box>

        <Box overflowY="auto" flex={1}>
          {searchResult.isLoading && (
            <Flex align="center" justify="center" py={4}>
              <Spinner size="sm" />
            </Flex>
          )}

          {!searchResult.isLoading && totalItems === 0 && (
            <Box p={4} textAlign="center">
              <Text color="fg.muted" fontSize="xs">
                {isSearching ? t('symbolSelector.noSymbolsFound') : t('common.typeToSearch')}
              </Text>
            </Box>
          )}

          {!searchResult.isLoading && totalItems > 0 && (
            <VStack gap={0} align="stretch">
              {isSearching ? (
                displaySymbols.slice(0, 20).map((symbol) =>
                  renderSymbolRow(symbol, openPositionSymbols.has(symbol.symbol))
                )
              ) : (
                <>
                  {openPositionItems.length > 0 && (
                    <>
                      {renderSectionHeader(t('symbolSelector.openPositions'))}
                      {openPositionItems.map((symbol) => renderSymbolRow(symbol, true))}
                    </>
                  )}
                  {activeChartItems.length > 0 && (
                    <>
                      {renderSectionHeader(t('symbolSelector.activeCharts'))}
                      {activeChartItems.map((symbol) => renderSymbolRow(symbol, false))}
                    </>
                  )}
                  {renderSectionHeader(t('symbolSelector.popularSymbols'))}
                  {filteredPopularSymbols.slice(0, 20).map((symbol) => renderSymbolRow(symbol, false))}
                  <Box px={3} py={1.5} bg="bg.subtle">
                    <Flex align="center" justify="space-between">
                      <Text fontSize="2xs" fontWeight="semibold" color="fg.muted" letterSpacing="wide">
                        {t('symbolSelector.customSymbols')}
                      </Text>
                      <Button
                        size="2xs"
                        variant="ghost"
                        onClick={() => {
                          setIsOpen(false);
                          customSymbolsManage.open();
                        }}
                        data-testid="symbol-selector-manage-custom"
                      >
                        <LuSettings size={11} />
                        {t('customSymbols.manage')}
                      </Button>
                    </Flex>
                  </Box>
                  {(customSymbolsQuery.data ?? []).map((cs) => (
                    <Box
                      key={cs.symbol}
                      px={3}
                      py={2}
                      cursor="pointer"
                      bg={value === cs.symbol ? 'bg.muted' : 'transparent'}
                      _hover={{ bg: 'bg.muted' }}
                      // Custom symbols are computed from constituent klines
                      // server-side regardless of which marketType is passed
                      // — the value is metadata only. FUTURES is the more
                      // common default for trading; the backend resolves
                      // the symbol via customSymbolService.ensureKlinesBackfilled
                      // before any direct Binance call would happen.
                      onClick={() => handleSelect(cs.symbol, { marketType: 'FUTURES', assetClass: 'CRYPTO' })}
                      borderBottomWidth="1px"
                      borderColor="border"
                    >
                      <Flex align="center" justify="space-between">
                        <Flex align="center" gap={2}>
                          <Flex direction="column">
                            <Text fontWeight={value === cs.symbol ? 'semibold' : 'medium'} fontSize="xs" color="fg">
                              {cs.symbol}
                            </Text>
                            <Text fontSize="2xs" color="fg.muted">{cs.name}</Text>
                          </Flex>
                        </Flex>
                        <Badge size="xs" colorPalette="purple" variant="subtle" px={2}>
                          {t('customSymbols.index')}
                        </Badge>
                      </Flex>
                    </Box>
                  ))}
                </>
              )}
            </VStack>
          )}
        </Box>
      </Flex>
    </Popover>
    <CustomSymbolsDialog isOpen={customSymbolsManage.isOpen} onClose={customSymbolsManage.close} />
    </>
  );
}
