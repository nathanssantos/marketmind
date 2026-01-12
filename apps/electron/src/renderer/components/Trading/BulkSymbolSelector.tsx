import { Box, Flex, Group, HStack, Spinner, Stack, Text } from '@chakra-ui/react';
import type { MarketType } from '@marketmind/types';
import { Button } from '@renderer/components/ui/button';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { CryptoIcon } from '@renderer/components/ui/CryptoIcon';
import { useTopCoinsByMarketCap } from '@renderer/hooks/useBackendAutoTrading';
import { useTranslation } from 'react-i18next';

interface BulkSymbolSelectorProps {
  selectedSymbols: string[];
  onSymbolsChange: (symbols: string[]) => void;
  marketType: MarketType;
  onMarketTypeChange: (marketType: MarketType) => void;
  limit?: number;
  showMarketTypeToggle?: boolean;
  maxHeight?: string;
}

export const BulkSymbolSelector = ({
  selectedSymbols,
  onSymbolsChange,
  marketType,
  onMarketTypeChange,
  limit = 100,
  showMarketTypeToggle = true,
  maxHeight = '300px',
}: BulkSymbolSelectorProps) => {
  const { t } = useTranslation();
  const { topCoins, isLoadingTopCoins } = useTopCoinsByMarketCap(marketType, limit);

  const handleSymbolToggle = (symbol: string) => {
    onSymbolsChange(
      selectedSymbols.includes(symbol)
        ? selectedSymbols.filter((s) => s !== symbol)
        : [...selectedSymbols, symbol]
    );
  };

  const handleSelectAll = () => {
    onSymbolsChange(topCoins.map((coin) => coin.binanceSymbol));
  };

  const handleDeselectAll = () => {
    onSymbolsChange([]);
  };

  const handleMarketTypeChange = (newMarketType: MarketType) => {
    onMarketTypeChange(newMarketType);
    onSymbolsChange([]);
  };

  return (
    <Stack gap={4}>
      {showMarketTypeToggle && (
        <Group attached>
          <Button
            size="sm"
            variant={marketType === 'SPOT' ? 'solid' : 'outline'}
            onClick={() => handleMarketTypeChange('SPOT')}
            flex={1}
          >
            Spot
          </Button>
          <Button
            size="sm"
            variant={marketType === 'FUTURES' ? 'solid' : 'outline'}
            onClick={() => handleMarketTypeChange('FUTURES')}
            flex={1}
          >
            Futures
          </Button>
        </Group>
      )}

      <Box>
        <Flex justify="space-between" align="center" mb={2}>
          <Text fontSize="sm" fontWeight="medium">
            {t('tradingProfiles.watchers.topSymbols', 'Top {{count}} Symbols by Market Cap', { count: limit })}
          </Text>
          <HStack gap={2}>
            <Button size="xs" variant="ghost" onClick={handleSelectAll} disabled={isLoadingTopCoins}>
              {t('tradingProfiles.watchers.selectAll', 'Select All')}
            </Button>
            <Button size="xs" variant="ghost" onClick={handleDeselectAll} disabled={isLoadingTopCoins}>
              {t('tradingProfiles.watchers.deselectAll', 'Deselect All')}
            </Button>
          </HStack>
        </Flex>

        {isLoadingTopCoins ? (
          <Flex justify="center" py={4}>
            <Spinner size="sm" />
          </Flex>
        ) : (
          <Box
            borderWidth="1px"
            borderRadius="md"
            p={3}
            maxH={maxHeight}
            overflowY="auto"
          >
            <Stack gap={2}>
              {topCoins.map((coin) => (
                <HStack key={coin.binanceSymbol} justify="space-between">
                  <HStack>
                    <Checkbox
                      checked={selectedSymbols.includes(coin.binanceSymbol)}
                      onCheckedChange={() => handleSymbolToggle(coin.binanceSymbol)}
                    />
                    <Box
                      bg="gray.100"
                      _dark={{ bg: 'gray.700' }}
                      px={1.5}
                      py={0.5}
                      borderRadius="sm"
                      minW="32px"
                      textAlign="center"
                    >
                      <Text fontSize="xs" fontWeight="bold" color="gray.600" _dark={{ color: 'gray.300' }}>
                        #{coin.marketCapRank}
                      </Text>
                    </Box>
                    <CryptoIcon symbol={coin.binanceSymbol} size={16} />
                    <Text fontSize="sm" fontFamily="mono">{coin.binanceSymbol}</Text>
                  </HStack>
                </HStack>
              ))}
            </Stack>
          </Box>
        )}

        <Text fontSize="xs" color="gray.500" mt={2}>
          {t('tradingProfiles.watchers.selectedCount', '{{count}} symbols selected', { count: selectedSymbols.length })}
        </Text>
      </Box>
    </Stack>
  );
};
