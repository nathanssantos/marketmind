import { VStack, Text } from '@chakra-ui/react';
import type { MarketType } from '@marketmind/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BulkSymbolSelector } from '../BulkSymbolSelector';

interface SymbolSectionProps {
  symbols: string[];
  onSymbolsChange: (symbols: string[]) => void;
}

export function SymbolSection({ symbols, onSymbolsChange }: SymbolSectionProps) {
  const { t } = useTranslation();
  const [marketType, setMarketType] = useState<MarketType>('FUTURES');

  return (
    <VStack gap={3} align="stretch">
      <Text fontWeight="semibold">{t('scalping.config.symbols')}</Text>

      <BulkSymbolSelector
        selectedSymbols={symbols}
        onSymbolsChange={onSymbolsChange}
        marketType={marketType}
        onMarketTypeChange={setMarketType}
        limit={50}
        maxHeight="250px"
      />
    </VStack>
  );
}
