import { NumberInput } from '@/renderer/components/ui/number-input';
import { Select } from '@/renderer/components/ui/select';
import { Switch } from '@/renderer/components/ui/switch';
import { Box, HStack, Separator, Spinner, Stack, Text } from '@chakra-ui/react';
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';
import { useMarketContextConfig } from '@renderer/hooks/useMarketContextConfig';
import { useToast } from '@renderer/hooks/useToast';
import type { MarketContextAction } from '@marketmind/types';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

interface FilterSectionProps {
  title: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  children: React.ReactNode;
}

const FilterSection = ({ title, description, enabled, onEnabledChange, children }: FilterSectionProps) => (
  <Box
    p={4}
    borderRadius="md"
    borderWidth="1px"
    borderColor={enabled ? 'green.500' : 'border'}
    bg={enabled ? 'green.50' : 'bg.subtle'}
    _dark={{ bg: enabled ? 'green.950' : 'bg.subtle' }}
  >
    <Stack gap={3}>
      <HStack justify="space-between">
        <Box>
          <Text fontSize="sm" fontWeight="semibold">{title}</Text>
          <Text fontSize="xs" color="fg.muted" mt={1}>{description}</Text>
        </Box>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} size="md" />
      </HStack>
      {enabled && <Box mt={2}>{children}</Box>}
    </Stack>
  </Box>
);

const ActionSelect = ({ value, onChange }: { value: MarketContextAction; onChange: (v: MarketContextAction) => void }) => {
  const { t } = useTranslation();
  const options = [
    { value: 'warn_only', label: t('marketContext.actions.warnOnly') },
    { value: 'reduce_size', label: t('marketContext.actions.reduceSize') },
    { value: 'penalize', label: t('marketContext.actions.penalize') },
    { value: 'block', label: t('marketContext.actions.block') },
  ];
  return (
    <Select
      value={value}
      options={options}
      onChange={(v) => onChange(v as MarketContextAction)}
      size="sm"
      minWidth="130px"
    />
  );
};

export const MarketContextConfigTab = (): ReactElement => {
  const { t } = useTranslation();
  const toast = useToast();
  const { wallets } = useBackendWallet();
  const walletId = wallets[0]?.id ?? '';
  const { config, isLoadingConfig, updateConfig, marketData } = useMarketContextConfig(walletId);

  const handleUpdate = async (updates: Parameters<typeof updateConfig.mutate>[0]) => {
    try {
      await updateConfig.mutateAsync(updates);
      toast.success(t('common.success'), t('marketContext.configUpdated'));
    } catch {
      toast.error(t('common.error'), t('marketContext.configUpdateFailed'));
    }
  };

  if (!walletId) {
    return (
      <Stack gap={4} p={4}>
        <Text color="fg.muted">{t('marketContext.noWallet')}</Text>
      </Stack>
    );
  }

  if (isLoadingConfig) {
    return (
      <Stack gap={4} p={4} align="center" justify="center">
        <Spinner size="lg" />
      </Stack>
    );
  }

  if (!config) {
    return (
      <Stack gap={4} p={4}>
        <Text color="fg.muted">{t('marketContext.configNotFound')}</Text>
      </Stack>
    );
  }

  return (
    <Stack gap={6}>
      <Box>
        <Text fontSize="lg" fontWeight="bold" mb={1}>
          {t('marketContext.title')}
        </Text>
        <Text fontSize="sm" color="fg.muted">
          {t('marketContext.description')}
        </Text>
      </Box>

      <Separator />

      <Stack gap={4}>
        <HStack justify="space-between" p={4} borderRadius="md" borderWidth="1px">
          <Box>
            <Text fontSize="md" fontWeight="semibold">{t('marketContext.masterSwitch')}</Text>
            <Text fontSize="xs" color="fg.muted">{t('marketContext.masterSwitchDescription')}</Text>
          </Box>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => handleUpdate({ enabled: checked })}
            size="lg"
          />
        </HStack>

        <HStack justify="space-between" p={4} borderRadius="md" borderWidth="1px" bg="yellow.50" _dark={{ bg: 'yellow.950' }}>
          <Box>
            <Text fontSize="md" fontWeight="semibold">{t('marketContext.shadowMode')}</Text>
            <Text fontSize="xs" color="fg.muted">{t('marketContext.shadowModeDescription')}</Text>
          </Box>
          <Switch
            checked={config.shadowMode}
            onCheckedChange={(checked) => handleUpdate({ shadowMode: checked })}
            size="lg"
          />
        </HStack>

        {marketData && (
          <Box p={4} borderRadius="md" borderWidth="1px" bg="blue.50" _dark={{ bg: 'blue.950' }}>
            <Text fontSize="sm" fontWeight="semibold" mb={2}>{t('marketContext.currentData')}</Text>
            <HStack gap={6} wrap="wrap">
              <Box>
                <Text fontSize="xs" color="fg.muted">{t('marketContext.fearGreed.label')}</Text>
                <Text fontSize="md" fontWeight="bold">{marketData.fearGreedIndex}</Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.muted">{t('marketContext.btcDominance.label')}</Text>
                <Text fontSize="md" fontWeight="bold">{marketData.btcDominance?.toFixed(2)}%</Text>
              </Box>
              {marketData.fundingRate !== undefined && (
                <Box>
                  <Text fontSize="xs" color="fg.muted">{t('marketContext.fundingRate.label')}</Text>
                  <Text fontSize="md" fontWeight="bold">{(marketData.fundingRate * 100).toFixed(4)}%</Text>
                </Box>
              )}
            </HStack>
          </Box>
        )}
      </Stack>

      <Separator />

      <Stack gap={4}>
        <FilterSection
          title={t('marketContext.fearGreed.title')}
          description={t('marketContext.fearGreed.description')}
          enabled={config.fearGreed.enabled}
          onEnabledChange={(enabled) => handleUpdate({ fearGreed: { enabled } })}
        >
          <Stack gap={3}>
            <HStack gap={4} wrap="wrap">
              <Box>
                <Text fontSize="xs" color="fg.muted" mb={1}>{t('marketContext.fearGreed.thresholdLow')}</Text>
                <NumberInput
                  value={config.fearGreed.thresholdLow}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdate({ fearGreed: { thresholdLow: parseInt(e.target.value) || 20 } })}
                  min={0}
                  max={100}
                  size="sm"
                  w="80px"
                />
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.muted" mb={1}>{t('marketContext.fearGreed.thresholdHigh')}</Text>
                <NumberInput
                  value={config.fearGreed.thresholdHigh}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdate({ fearGreed: { thresholdHigh: parseInt(e.target.value) || 80 } })}
                  min={0}
                  max={100}
                  size="sm"
                  w="80px"
                />
              </Box>
            </HStack>
            <HStack gap={4} wrap="wrap">
              <Box>
                <Text fontSize="xs" color="fg.muted" mb={1}>{t('marketContext.action')}</Text>
                <ActionSelect
                  value={config.fearGreed.action}
                  onChange={(action) => handleUpdate({ fearGreed: { action } })}
                />
              </Box>
              {config.fearGreed.action === 'reduce_size' && (
                <Box>
                  <Text fontSize="xs" color="fg.muted" mb={1}>{t('marketContext.sizeReduction')}</Text>
                  <NumberInput
                    value={config.fearGreed.sizeReduction}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdate({ fearGreed: { sizeReduction: parseInt(e.target.value) || 50 } })}
                    min={0}
                    max={100}
                    size="sm"
                    w="80px"
                  />
                </Box>
              )}
            </HStack>
          </Stack>
        </FilterSection>

        <FilterSection
          title={t('marketContext.fundingRate.title')}
          description={t('marketContext.fundingRate.description')}
          enabled={config.fundingRate.enabled}
          onEnabledChange={(enabled) => handleUpdate({ fundingRate: { enabled } })}
        >
          <Stack gap={3}>
            <HStack gap={4} wrap="wrap">
              <Box>
                <Text fontSize="xs" color="fg.muted" mb={1}>{t('marketContext.fundingRate.threshold')}</Text>
                <NumberInput
                  value={config.fundingRate.threshold}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdate({ fundingRate: { threshold: parseFloat(e.target.value) || 0.05 } })}
                  min={0}
                  max={1}
                  step={0.01}
                  size="sm"
                  w="100px"
                />
              </Box>
            </HStack>
            <HStack gap={4} wrap="wrap">
              <Box>
                <Text fontSize="xs" color="fg.muted" mb={1}>{t('marketContext.action')}</Text>
                <ActionSelect
                  value={config.fundingRate.action}
                  onChange={(action) => handleUpdate({ fundingRate: { action } })}
                />
              </Box>
              {config.fundingRate.action === 'penalize' && (
                <Box>
                  <Text fontSize="xs" color="fg.muted" mb={1}>{t('marketContext.penalty')}</Text>
                  <NumberInput
                    value={config.fundingRate.penalty}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdate({ fundingRate: { penalty: parseInt(e.target.value) || 20 } })}
                    min={0}
                    max={100}
                    size="sm"
                    w="80px"
                  />
                </Box>
              )}
            </HStack>
          </Stack>
        </FilterSection>

        <FilterSection
          title={t('marketContext.btcDominance.title')}
          description={t('marketContext.btcDominance.description')}
          enabled={config.btcDominance.enabled}
          onEnabledChange={(enabled) => handleUpdate({ btcDominance: { enabled } })}
        >
          <Stack gap={3}>
            <HStack gap={4} wrap="wrap">
              <Box>
                <Text fontSize="xs" color="fg.muted" mb={1}>{t('marketContext.btcDominance.changeThreshold')}</Text>
                <NumberInput
                  value={config.btcDominance.changeThreshold}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdate({ btcDominance: { changeThreshold: parseFloat(e.target.value) || 1.0 } })}
                  min={0}
                  max={10}
                  step={0.1}
                  size="sm"
                  w="100px"
                />
              </Box>
            </HStack>
            <HStack gap={4} wrap="wrap">
              <Box>
                <Text fontSize="xs" color="fg.muted" mb={1}>{t('marketContext.action')}</Text>
                <ActionSelect
                  value={config.btcDominance.action}
                  onChange={(action) => handleUpdate({ btcDominance: { action } })}
                />
              </Box>
              {config.btcDominance.action === 'reduce_size' && (
                <Box>
                  <Text fontSize="xs" color="fg.muted" mb={1}>{t('marketContext.sizeReduction')}</Text>
                  <NumberInput
                    value={config.btcDominance.sizeReduction}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdate({ btcDominance: { sizeReduction: parseInt(e.target.value) || 25 } })}
                    min={0}
                    max={100}
                    size="sm"
                    w="80px"
                  />
                </Box>
              )}
            </HStack>
          </Stack>
        </FilterSection>

        <FilterSection
          title={t('marketContext.openInterest.title')}
          description={t('marketContext.openInterest.description')}
          enabled={config.openInterest.enabled}
          onEnabledChange={(enabled) => handleUpdate({ openInterest: { enabled } })}
        >
          <Stack gap={3}>
            <HStack gap={4} wrap="wrap">
              <Box>
                <Text fontSize="xs" color="fg.muted" mb={1}>{t('marketContext.openInterest.changeThreshold')}</Text>
                <NumberInput
                  value={config.openInterest.changeThreshold}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdate({ openInterest: { changeThreshold: parseFloat(e.target.value) || 10 } })}
                  min={0}
                  max={100}
                  step={1}
                  size="sm"
                  w="100px"
                />
              </Box>
            </HStack>
            <HStack gap={4} wrap="wrap">
              <Box>
                <Text fontSize="xs" color="fg.muted" mb={1}>{t('marketContext.action')}</Text>
                <ActionSelect
                  value={config.openInterest.action}
                  onChange={(action) => handleUpdate({ openInterest: { action } })}
                />
              </Box>
            </HStack>
          </Stack>
        </FilterSection>
      </Stack>
    </Stack>
  );
};
