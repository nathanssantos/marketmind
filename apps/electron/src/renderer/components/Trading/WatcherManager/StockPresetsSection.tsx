import { Box, Flex, Stack, Text, Wrap, WrapItem } from '@chakra-ui/react';
import { Button } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';
import { LuBuilding2, LuPlay } from 'react-icons/lu';

export interface StockPreset {
  id: string;
  name: string;
  symbols: string[];
}

const STOCK_PRESETS: StockPreset[] = [
  {
    id: 'faang',
    name: 'FAANG+',
    symbols: ['AAPL', 'AMZN', 'META', 'GOOGL', 'NFLX', 'NVDA'],
  },
  {
    id: 'etfs',
    name: 'Major ETFs',
    symbols: ['SPY', 'QQQ', 'DIA', 'IWM'],
  },
  {
    id: 'tech',
    name: 'Tech Leaders',
    symbols: ['MSFT', 'TSLA', 'AMD', 'INTC', 'CRM', 'ORCL'],
  },
  {
    id: 'finance',
    name: 'Financials',
    symbols: ['JPM', 'BAC', 'GS', 'MS', 'V', 'MA'],
  },
];

export interface StockPresetsSectionProps {
  onStartPreset: (symbols: string[]) => void;
  isStarting: boolean;
  disabled?: boolean;
}

export const StockPresetsSection = ({ onStartPreset, isStarting, disabled = false }: StockPresetsSectionProps) => {
  const { t } = useTranslation();

  return (
    <Box p={3} bg="green.subtle" borderRadius="md" borderWidth="1px" borderColor="green.muted">
      <Flex align="center" gap={2} mb={3}>
        <LuBuilding2 size={16} />
        <Text fontSize="sm" fontWeight="medium">
          {t('watcherManager.stockPresets.title', 'Stock Presets (IB)')}
        </Text>
      </Flex>

      <Stack gap={3}>
        <Text fontSize="xs" color="fg.muted">
          {t('watcherManager.stockPresets.description', 'Quick start watchers for popular US stocks via Interactive Brokers')}
        </Text>

        <Wrap gap={2}>
          {STOCK_PRESETS.map((preset) => (
            <WrapItem key={preset.id}>
              <Button
                size="xs"
                variant="outline"
                colorPalette="green"
                onClick={() => onStartPreset(preset.symbols)}
                loading={isStarting}
                disabled={disabled || isStarting}
                title={preset.symbols.join(', ')}
              >
                <LuPlay size={12} />
                {preset.name} ({preset.symbols.length})
              </Button>
            </WrapItem>
          ))}
        </Wrap>

        <Text fontSize="2xs" color="fg.muted">
          {t('watcherManager.stockPresets.note', 'Requires IB Gateway or TWS running locally on port 4001 (live) or 4002 (paper)')}
        </Text>
      </Stack>
    </Box>
  );
};

export { STOCK_PRESETS };
