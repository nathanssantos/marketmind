import { Box, Group, HStack, Stack, Text } from '@chakra-ui/react';
import type { MarketType, TradingProfile } from '@marketmind/types';
import { Button } from '@renderer/components/ui/button';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { Field } from '@renderer/components/ui/field';
import { FormDialog } from '@renderer/components/ui/FormDialog';
import { Select } from '@renderer/components/ui/select';
import { useBackendAutoTrading } from '@renderer/hooks/useBackendAutoTrading';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Timeframe, TimeframeSelector } from '../Chart/TimeframeSelector';
import { SymbolSelector } from '../SymbolSelector';
import { BulkSymbolSelector } from './BulkSymbolSelector';

interface AddWatcherDialogProps {
  isOpen: boolean;
  onClose: () => void;
  walletId: string;
  profiles: TradingProfile[];
}

export const AddWatcherDialog = ({
  isOpen,
  onClose,
  walletId,
  profiles,
}: AddWatcherDialogProps) => {
  const { t } = useTranslation();
  const { startWatcher, startWatchersBulk, isStartingWatcher, isStartingWatchersBulk } = useBackendAutoTrading(walletId);

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [interval, setInterval] = useState<Timeframe>('1h');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [useDefault, setUseDefault] = useState(true);
  const [marketType, setMarketType] = useState<MarketType>('SPOT');

  const handleSymbolChange = (newSymbol: string, newMarketType?: MarketType) => {
    setSymbol(newSymbol);
    if (newMarketType) setMarketType(newMarketType);
  };

  const handleMarketTypeChange = (newMarketType: MarketType) => {
    setMarketType(newMarketType);
    setSelectedSymbols([]);
  };

  const handleSubmit = async () => {
    if (isBulkMode) {
      if (selectedSymbols.length === 0) return;
      await startWatchersBulk(
        selectedSymbols,
        interval,
        useDefault ? undefined : profileId ?? undefined,
        marketType
      );
    } else {
      if (!symbol.trim()) return;
      await startWatcher(
        symbol.trim().toUpperCase(),
        interval,
        useDefault ? undefined : profileId ?? undefined,
        marketType
      );
    }
    onClose();
    resetForm();
  };

  const resetForm = () => {
    setSymbol('BTCUSDT');
    setSelectedSymbols([]);
    setInterval('1h' as Timeframe);
    setProfileId(null);
    setUseDefault(true);
    setMarketType('SPOT');
    setIsBulkMode(false);
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  const isLoading = isStartingWatcher || isStartingWatchersBulk;
  const canSubmit = isBulkMode
    ? selectedSymbols.length > 0 && !isLoading
    : symbol.trim().length > 0 && !isLoading;

  const profileOptions = [
    { value: '', label: t('tradingProfiles.watchers.selectProfile') },
    ...profiles.map((p) => ({
      value: p.id,
      label: p.isDefault ? `${p.name} (${t('common.default')})` : p.name,
    })),
  ];

  const submitLabel = isBulkMode
    ? t('tradingProfiles.watchers.startBulk', 'Start {{count}} Watchers', { count: selectedSymbols.length })
    : t('tradingProfiles.watchers.start');

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={t('tradingProfiles.watchers.addTitle')}
      size="md"
      onSubmit={() => void handleSubmit()}
      submitLabel={submitLabel}
      submitColorPalette="green"
      submitDisabled={!canSubmit}
      isLoading={isLoading}
    >
      <Stack gap={5}>
        <Group attached>
          <Button
            size="sm"
            variant={!isBulkMode ? 'solid' : 'outline'}
            onClick={() => setIsBulkMode(false)}
            flex={1}
          >
            {t('tradingProfiles.watchers.singleMode', 'Single')}
          </Button>
          <Button
            size="sm"
            variant={isBulkMode ? 'solid' : 'outline'}
            onClick={() => setIsBulkMode(true)}
            flex={1}
          >
            {t('tradingProfiles.watchers.bulkMode', 'Bulk')}
          </Button>
        </Group>

        {!isBulkMode ? (
          <HStack gap={4} align="flex-end">
            <Field label={t('tradingProfiles.watchers.symbol')} required>
              <SymbolSelector
                value={symbol}
                onChange={handleSymbolChange}
                marketType={marketType}
                onMarketTypeChange={setMarketType}
                showMarketTypeToggle
              />
            </Field>

            <Field label={t('tradingProfiles.watchers.interval')}>
              <TimeframeSelector
                selectedTimeframe={interval}
                onTimeframeChange={setInterval}
              />
            </Field>
          </HStack>
        ) : (
          <Stack gap={4}>
            <Field label={t('tradingProfiles.watchers.interval')}>
              <TimeframeSelector
                selectedTimeframe={interval}
                onTimeframeChange={setInterval}
              />
            </Field>

            <BulkSymbolSelector
              selectedSymbols={selectedSymbols}
              onSymbolsChange={setSelectedSymbols}
              marketType={marketType}
              onMarketTypeChange={handleMarketTypeChange}
              limit={50}
              showMarketTypeToggle
              maxHeight="200px"
            />
          </Stack>
        )}

        {marketType === 'FUTURES' && (
          <Box
            p={2}
            borderRadius="sm"
            bg="orange.50"
            borderWidth="1px"
            borderColor="orange.200"
            _dark={{ bg: 'orange.950', borderColor: 'orange.800' }}
          >
            <Text fontSize="xs" color="orange.700" _dark={{ color: 'orange.300' }}>
              {t('tradingProfiles.watchers.futuresWarning', 'Futures trading involves higher risk due to leverage. Ensure your wallet has Futures API permissions enabled.')}
            </Text>
          </Box>
        )}

        <Box>
          <HStack mb={3}>
            <Checkbox
              checked={useDefault}
              onCheckedChange={setUseDefault}
            />
            <Text fontSize="sm">{t('tradingProfiles.watchers.useWalletDefault')}</Text>
          </HStack>

          {!useDefault && (
            <Field label={t('tradingProfiles.watchers.profile')}>
              <Select
                value={profileId ?? ''}
                onChange={(value) => setProfileId(value || null)}
                options={profileOptions}
                usePortal={false}
              />
            </Field>
          )}

          {!useDefault && profiles.length === 0 && (
            <Box
              p={3}
              mt={2}
              borderRadius="md"
              bg="orange.50"
              borderWidth="1px"
              borderColor="orange.200"
              _dark={{ bg: 'orange.950', borderColor: 'orange.800' }}
            >
              <Text fontSize="xs" color="orange.700" _dark={{ color: 'orange.300' }}>
                {t('tradingProfiles.watchers.noProfiles')}
              </Text>
            </Box>
          )}
        </Box>

        <Box
          p={3}
          borderRadius="md"
          bg="blue.50"
          borderWidth="1px"
          borderColor="blue.200"
          _dark={{ bg: 'blue.950', borderColor: 'blue.800' }}
        >
          <Text fontSize="xs" color="blue.700" _dark={{ color: 'blue.300' }}>
            {t('tradingProfiles.watchers.info')}
          </Text>
        </Box>
      </Stack>
    </FormDialog>
  );
};
