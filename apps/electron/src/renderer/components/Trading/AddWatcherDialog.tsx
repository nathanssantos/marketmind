import { Box, Group, HStack, Stack, Text } from '@chakra-ui/react';
import type { DialogControlProps, MarketType, TradingProfile } from '@marketmind/types';
import { Button, Callout, Checkbox, Field, FormDialog, Select } from '@renderer/components/ui';
import { useBackendAutoTrading } from '@renderer/hooks/useBackendAutoTrading';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_TIMEFRAME } from '@renderer/constants/defaults';
import { type Timeframe, TimeframeSelector } from '../Chart/TimeframeSelector';
import { SymbolSelector } from '../SymbolSelector';
import { BulkSymbolSelector } from './BulkSymbolSelector';

interface AddWatcherDialogProps extends DialogControlProps {
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
  const [interval, setInterval] = useState<Timeframe>(DEFAULT_TIMEFRAME);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [useDefault, setUseDefault] = useState(true);
  const [marketType, setMarketType] = useState<MarketType>('FUTURES');

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
    setInterval('1h');
    setProfileId(null);
    setUseDefault(true);
    setMarketType('FUTURES');
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
    ? t('tradingProfiles.watchers.startBulk', { count: selectedSymbols.length })
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
      <Stack gap={3}>
        <Group attached>
          <Button
            size="xs"
            variant={!isBulkMode ? 'solid' : 'outline'}
            onClick={() => setIsBulkMode(false)}
            flex={1}
          >
            {t('tradingProfiles.watchers.singleMode')}
          </Button>
          <Button
            size="xs"
            variant={isBulkMode ? 'solid' : 'outline'}
            onClick={() => setIsBulkMode(true)}
            flex={1}
          >
            {t('tradingProfiles.watchers.bulkMode')}
          </Button>
        </Group>

        {!isBulkMode ? (
          <HStack gap={3} align="flex-end">
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
          <Stack gap={3}>
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
          <Callout tone="warning" compact>
            {t('tradingProfiles.watchers.futuresWarning')}
          </Callout>
        )}

        <Box>
          <HStack mb={2}>
            <Checkbox checked={useDefault} onCheckedChange={setUseDefault} />
            <Text fontSize="xs">{t('tradingProfiles.watchers.useWalletDefault')}</Text>
          </HStack>

          {!useDefault && (
            <Field label={t('tradingProfiles.watchers.profile')}>
              <Select
                value={profileId ?? ''}
                onChange={(value) => setProfileId(value || null)}
                options={profileOptions}
                size="sm"
                usePortal={false}
              />
            </Field>
          )}

          {!useDefault && profiles.length === 0 && (
            <Box mt={2}>
              <Callout tone="warning" compact>
                {t('tradingProfiles.watchers.noProfiles')}
              </Callout>
            </Box>
          )}
        </Box>

        <Callout tone="info" compact>
          {t('tradingProfiles.watchers.info')}
        </Callout>
      </Stack>
    </FormDialog>
  );
};
