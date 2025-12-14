import {
  Box,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  Flex,
  HStack,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react';
import type { TradingProfile } from '@marketmind/types';
import { Button } from '@renderer/components/ui/button';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { Field } from '@renderer/components/ui/field';
import { Select } from '@renderer/components/ui/select';
import { useBackendAutoTrading } from '@renderer/hooks/useBackendAutoTrading';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const INTERVALS = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1d' },
];

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
  const [interval, setInterval] = useState('1d');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [useDefault, setUseDefault] = useState(true);

  const handleSubmit = async () => {
    if (!symbol.trim()) return;

    await startWatcher(symbol.trim().toUpperCase(), interval, useDefault ? undefined : profileId ?? undefined);
    onClose();
    resetForm();
  };

  const resetForm = () => {
    setSymbol('BTCUSDT');
    setInterval('1d');
    setProfileId(null);
    setUseDefault(true);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('tradingProfiles.watchers.addTitle')}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <Stack gap={5}>
            <Field label={t('tradingProfiles.watchers.symbol')} required>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="BTCUSDT"
                maxLength={20}
              />
            </Field>

            <Field label={t('tradingProfiles.watchers.interval')}>
              <Flex gap={2} flexWrap="wrap">
                {INTERVALS.map((int) => (
                  <Button
                    key={int.value}
                    size="sm"
                    variant={interval === int.value ? 'solid' : 'outline'}
                    colorPalette={interval === int.value ? 'blue' : 'gray'}
                    onClick={() => setInterval(int.value)}
                  >
                    {int.label}
                  </Button>
                ))}
              </Flex>
            </Field>

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
            onClick={handleSubmit}
            loading={isStartingWatcher}
            disabled={!canSubmit}
          >
            {t('tradingProfiles.watchers.start')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
