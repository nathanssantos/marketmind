import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import {
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import type { MarketType, TradingProfile } from '@marketmind/types';
import { Button } from '@renderer/components/ui/button';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { Field } from '@renderer/components/ui/field';
import { Select } from '@renderer/components/ui/select';
import { useBackendAutoTrading } from '@renderer/hooks/useBackendAutoTrading';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Timeframe, TimeframeSelector } from '../Chart/TimeframeSelector';
import { SymbolSelector } from '../SymbolSelector';

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
  const { startWatcher, isStartingWatcher } = useBackendAutoTrading(walletId);

  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState<Timeframe>('1d');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [useDefault, setUseDefault] = useState(true);
  const [marketType, setMarketType] = useState<MarketType>('SPOT');

  const handleSymbolChange = (newSymbol: string, newMarketType?: MarketType) => {
    setSymbol(newSymbol);
    if (newMarketType) setMarketType(newMarketType);
  };

  const handleSubmit = async () => {
    if (!symbol.trim()) return;

    await startWatcher(
      symbol.trim().toUpperCase(),
      interval,
      useDefault ? undefined : profileId ?? undefined,
      marketType
    );
    onClose();
    resetForm();
  };

  const resetForm = () => {
    setSymbol('BTCUSDT');
    setInterval('1d' as Timeframe);
    setProfileId(null);
    setUseDefault(true);
    setMarketType('SPOT');
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  const canSubmit = symbol.trim().length > 0 && !isStartingWatcher;

  const profileOptions = [
    { value: '', label: t('tradingProfiles.watchers.selectProfile') },
    ...profiles.map((p) => ({
      value: p.id,
      label: p.isDefault ? `${p.name} (${t('common.default')})` : p.name,
    })),
  ];

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && handleClose()} size="md">
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tradingProfiles.watchers.addTitle')}</DialogTitle>
          </DialogHeader>

          <DialogBody>
            <Stack gap={5}>
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
                    ⚠️ {t('tradingProfiles.watchers.futuresWarning', 'Futures trading involves higher risk due to leverage. Ensure your wallet has Futures API permissions enabled.')}
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
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" onClick={handleClose} disabled={isStartingWatcher}>
              {t('common.cancel')}
            </Button>
            <Button
              colorPalette="green"
              onClick={() => void handleSubmit()}
              loading={isStartingWatcher}
              disabled={!canSubmit}
            >
              {t('tradingProfiles.watchers.start')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
};
