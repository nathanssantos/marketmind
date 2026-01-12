import { Box, Flex, Group, HStack, Spinner, Stack, Text } from '@chakra-ui/react';
import type { MarketType } from '@marketmind/types';
import { Button } from '@renderer/components/ui/button';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { CryptoIcon } from '@renderer/components/ui/CryptoIcon';
import { useTopSymbols } from '@renderer/hooks/useBackendAutoTrading';
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
  limit = 50,
  showMarketTypeToggle = true,
  maxHeight = '200px',
}: BulkSymbolSelectorProps) => {
  const { t } = useTranslation();
  const { topSymbols, isLoadingTopSymbols } = useTopSymbols(marketType, limit);

  const handleSymbolToggle = (symbol: string) => {
    onSymbolsChange(
      selectedSymbols.includes(symbol)
        ? selectedSymbols.filter((s) => s !== symbol)
        : [...selectedSymbols, symbol]
    );
  };

  const handleSelectAll = () => {
    onSymbolsChange([...topSymbols]);
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
            <Button size="xs" variant="ghost" onClick={handleSelectAll} disabled={isLoadingTopSymbols}>
              {t('tradingProfiles.watchers.selectAll', 'Select All')}
            </Button>
            <Button size="xs" variant="ghost" onClick={handleDeselectAll} disabled={isLoadingTopSymbols}>
              {t('tradingProfiles.watchers.deselectAll', 'Deselect All')}
            </Button>
          </HStack>
        </Flex>

        {isLoadingTopSymbols ? (
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
              {topSymbols.map((sym) => (
                <HStack key={sym}>
                  <Checkbox
                    checked={selectedSymbols.includes(sym)}
                    onCheckedChange={() => handleSymbolToggle(sym)}
                  />
                  <CryptoIcon symbol={sym} size={16} />
                  <Text fontSize="sm" fontFamily="mono">{sym}</Text>
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
