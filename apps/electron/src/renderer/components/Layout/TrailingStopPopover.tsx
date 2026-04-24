import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { Button, Popover, Switch, ToggleIconButton, TooltipWrapper } from '@renderer/components/ui';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { usePollingInterval } from '@renderer/hooks/usePollingInterval';
import { useToast } from '@renderer/hooks/useToast';
import { useTrailingStopPlacementStore } from '@renderer/store/trailingStopPlacementStore';
import { trpc } from '@renderer/utils/trpc';
import type { TimeInterval } from '@marketmind/types';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCrosshair, LuShield } from 'react-icons/lu';
import { TrailingStopSection } from '../Trading/WatcherManager/TrailingStopSection';

interface TrailingStopPopoverProps {
  symbol: string;
  triggerElement?: React.ReactNode;
}

export const TrailingStopPopover = memo(({ symbol, triggerElement }: TrailingStopPopoverProps) => {
  const { t } = useTranslation();
  const { success, info } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const pendingFieldsRef = useRef<Record<string, unknown>>({});

  const { activeWallet } = useActiveWallet();
  const walletId = activeWallet?.id ?? '';
  const pollingInterval = usePollingInterval(10_000);

  const { data: symbolConfig } = trpc.trading.getSymbolTrailingConfig.useQuery(
    { walletId, symbol },
    { enabled: !!walletId && !!symbol, refetchInterval: pollingInterval, staleTime: 5000 }
  );

  const { data: walletConfig } = trpc.autoTrading.getConfig.useQuery(
    { walletId },
    { enabled: !!walletId, refetchInterval: pollingInterval, staleTime: 5000 }
  );

  const utils = trpc.useUtils();

  const lastSentFieldsRef = useRef<Record<string, unknown>>({});

  const updateMutation = trpc.trading.updateSymbolTrailingConfig.useMutation({
    onSuccess: () => {
      void utils.trading.getSymbolTrailingConfig.invalidate({ walletId, symbol });
      const sent = lastSentFieldsRef.current;

      const meta = { symbol };
      if ('trailingStopEnabled' in sent) {
        const enabled = sent['trailingStopEnabled'];
        const key = enabled ? 'trailingStopEnabled' : 'trailingStopDisabled';
        (enabled ? success : info)(t(`positionTrailingStop.${key}`, { symbol }), undefined, meta);
      }
      if ('manualTrailingActivatedLong' in sent) {
        const activated = sent['manualTrailingActivatedLong'];
        const key = activated ? 'trailingLongActivated' : 'trailingLongDeactivated';
        (activated ? success : info)(t(`positionTrailingStop.${key}`, { symbol }), undefined, meta);
      }
      if ('manualTrailingActivatedShort' in sent) {
        const activated = sent['manualTrailingActivatedShort'];
        const key = activated ? 'trailingShortActivated' : 'trailingShortDeactivated';
        (activated ? success : info)(t(`positionTrailingStop.${key}`, { symbol }), undefined, meta);
      }

      lastSentFieldsRef.current = {};
    },
  });

  const mutateRef = useRef(updateMutation.mutate);
  mutateRef.current = updateMutation.mutate;

  const debouncedUpdate = useCallback((fields: Record<string, unknown>) => {
    pendingFieldsRef.current = { ...pendingFieldsRef.current, ...fields };
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      lastSentFieldsRef.current = { ...pendingFieldsRef.current };
      mutateRef.current({ walletId, symbol, ...pendingFieldsRef.current });
      pendingFieldsRef.current = {};
    }, 300);
  }, [walletId, symbol]);

  const useIndividualConfig = symbolConfig?.useIndividualConfig ?? false;

  const effectiveValues = useMemo(() => {
    if (useIndividualConfig && symbolConfig) {
      return {
        trailingStopEnabled: symbolConfig.trailingStopEnabled ?? walletConfig?.trailingStopEnabled ?? true,
        trailingActivationPercentLong: symbolConfig.trailingActivationPercentLong
          ? parseFloat(symbolConfig.trailingActivationPercentLong)
          : walletConfig?.trailingActivationPercentLong
            ? parseFloat(walletConfig.trailingActivationPercentLong)
            : 0.9,
        trailingActivationPercentShort: symbolConfig.trailingActivationPercentShort
          ? parseFloat(symbolConfig.trailingActivationPercentShort)
          : walletConfig?.trailingActivationPercentShort
            ? parseFloat(walletConfig.trailingActivationPercentShort)
            : 0.8,
        trailingDistancePercentLong: symbolConfig.trailingDistancePercentLong
          ? parseFloat(symbolConfig.trailingDistancePercentLong)
          : walletConfig?.trailingDistancePercentLong
            ? parseFloat(walletConfig.trailingDistancePercentLong)
            : 0.4,
        trailingDistancePercentShort: symbolConfig.trailingDistancePercentShort
          ? parseFloat(symbolConfig.trailingDistancePercentShort)
          : walletConfig?.trailingDistancePercentShort
            ? parseFloat(walletConfig.trailingDistancePercentShort)
            : 0.3,
        useAdaptiveTrailing: symbolConfig.useAdaptiveTrailing ?? walletConfig?.useAdaptiveTrailing ?? true,
        trailingDistanceMode: (symbolConfig.trailingDistanceMode ?? walletConfig?.trailingDistanceMode ?? 'fixed'),
        trailingStopOffsetPercent: symbolConfig.trailingStopOffsetPercent
          ? parseFloat(symbolConfig.trailingStopOffsetPercent)
          : walletConfig?.trailingStopOffsetPercent
            ? parseFloat(walletConfig.trailingStopOffsetPercent)
            : 0,
        activationModeLong: (symbolConfig.trailingActivationModeLong ?? walletConfig?.trailingActivationModeLong ?? 'auto'),
        activationModeShort: (symbolConfig.trailingActivationModeShort ?? walletConfig?.trailingActivationModeShort ?? 'auto'),
        manualTrailingActivatedLong: symbolConfig.manualTrailingActivatedLong ?? false,
        manualTrailingActivatedShort: symbolConfig.manualTrailingActivatedShort ?? false,
        indicatorInterval: symbolConfig.indicatorInterval ?? walletConfig?.trailingStopIndicatorInterval ?? '30m',
      };
    }

    return {
      trailingStopEnabled: walletConfig?.trailingStopEnabled ?? true,
      trailingActivationPercentLong: walletConfig?.trailingActivationPercentLong
        ? parseFloat(walletConfig.trailingActivationPercentLong)
        : 0.9,
      trailingActivationPercentShort: walletConfig?.trailingActivationPercentShort
        ? parseFloat(walletConfig.trailingActivationPercentShort)
        : 0.8,
      trailingDistancePercentLong: walletConfig?.trailingDistancePercentLong
        ? parseFloat(walletConfig.trailingDistancePercentLong)
        : 0.4,
      trailingDistancePercentShort: walletConfig?.trailingDistancePercentShort
        ? parseFloat(walletConfig.trailingDistancePercentShort)
        : 0.3,
      useAdaptiveTrailing: walletConfig?.useAdaptiveTrailing ?? true,
      trailingDistanceMode: (walletConfig?.trailingDistanceMode ?? 'fixed'),
      trailingStopOffsetPercent: walletConfig?.trailingStopOffsetPercent
        ? parseFloat(walletConfig.trailingStopOffsetPercent)
        : 0,
      activationModeLong: (walletConfig?.trailingActivationModeLong ?? 'auto'),
      activationModeShort: (walletConfig?.trailingActivationModeShort ?? 'auto'),
      manualTrailingActivatedLong: false,
      manualTrailingActivatedShort: false,
      indicatorInterval: walletConfig?.trailingStopIndicatorInterval ?? '30m',
    };
  }, [symbolConfig, walletConfig, useIndividualConfig]);

  const isTrailingActive = effectiveValues.trailingStopEnabled;

  const tooltipLabel = useMemo(() => {
    if (!isTrailingActive) return `${t('positionTrailingStop.title')} - ${t('common.disabled')}`;
    const longMode = effectiveValues.activationModeLong === 'auto'
      ? `Auto ${(effectiveValues.trailingActivationPercentLong * 100).toFixed(0)}%`
      : 'Manual';
    const shortMode = effectiveValues.activationModeShort === 'auto'
      ? `Auto ${(effectiveValues.trailingActivationPercentShort * 100).toFixed(0)}%`
      : 'Manual';
    return `${t('positionTrailingStop.title')}\nLONG: ${longMode}\nSHORT: ${shortMode}`;
  }, [isTrailingActive, effectiveValues, t]);

  const handleClick = useCallback(() => {
    const newEnabled = !isTrailingActive;
    debouncedUpdate({ trailingStopEnabled: newEnabled, useIndividualConfig: true });
  }, [isTrailingActive, debouncedUpdate]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsOpen((prev) => !prev);
  }, []);

  const activatePlacement = useTrailingStopPlacementStore((s) => s.activate);

  const handlePlaceOnChart = useCallback(() => {
    setIsOpen(false);
    activatePlacement();
  }, [activatePlacement]);

  if (!walletId) return null;

  return (
    <Box position="relative" lineHeight={0}>
      <Popover
        open={isOpen}
        onOpenChange={(details) => setIsOpen(details.open)}
        width="280px"
        positioning={{ placement: 'bottom-start', offset: { mainAxis: 8 } }}
        trigger={
          triggerElement ?? (
            <Box>
              <TooltipWrapper
                label={tooltipLabel}
                showArrow
                placement="bottom"
                isDisabled={isOpen}
              >
                <ToggleIconButton
                  active={isTrailingActive}
                  aria-label={t('positionTrailingStop.title')}
                  size="2xs"
                  h="22px"
                  w="22px"
                  onClick={handleClick}
                  onContextMenu={handleContextMenu}
                >
                  <LuShield />
                </ToggleIconButton>
              </TooltipWrapper>
          </Box>
          )
        }
      >
        <VStack gap={2} p={3} align="stretch" maxH="80vh" overflowY="auto">
          <HStack justify="space-between">
            <Text fontSize="xs" fontWeight="semibold" color="fg">
              {t('positionTrailingStop.title')} - {symbol}
            </Text>
            <TooltipWrapper label={t('positionTrailingStop.placeOnChart')}>
              <Button
                size="2xs"
                variant="outline"
                colorPalette="orange"
                onClick={handlePlaceOnChart}
                h="20px"
                px={2}
                fontSize="xs"
              >
                <LuCrosshair size={12} />
                {t('positionTrailingStop.placeOnChart')}
              </Button>
            </TooltipWrapper>
          </HStack>

          <HStack justify="space-between" p={1.5} bg="bg.subtle" borderRadius="md">
            <Box>
              <Text fontSize="xs" fontWeight="medium">
                {useIndividualConfig
                  ? t('positionTrailingStop.useIndividualConfig')
                  : t('positionTrailingStop.useGlobalConfig')}
              </Text>
            </Box>
            <Switch
              checked={useIndividualConfig}
              onCheckedChange={(checked) => {
                debouncedUpdate({ useIndividualConfig: checked });
              }}
              size="sm"
            />
          </HStack>

          <Box opacity={useIndividualConfig ? 1 : 0.5} pointerEvents={useIndividualConfig ? 'auto' : 'none'}>
            <TrailingStopSection
              compact
              isExpanded={true}
              onToggle={() => {}}
              trailingStopEnabled={effectiveValues.trailingStopEnabled}
              onTrailingStopEnabledChange={(enabled) => debouncedUpdate({ trailingStopEnabled: enabled })}
              trailingActivationPercentLong={effectiveValues.trailingActivationPercentLong}
              onTrailingActivationPercentLongChange={(value) => debouncedUpdate({ trailingActivationPercentLong: value.toString() })}
              trailingActivationPercentShort={effectiveValues.trailingActivationPercentShort}
              onTrailingActivationPercentShortChange={(value) => debouncedUpdate({ trailingActivationPercentShort: value.toString() })}
              trailingDistancePercentLong={effectiveValues.trailingDistancePercentLong}
              onTrailingDistancePercentLongChange={(value) => debouncedUpdate({ trailingDistancePercentLong: value.toString() })}
              trailingDistancePercentShort={effectiveValues.trailingDistancePercentShort}
              onTrailingDistancePercentShortChange={(value) => debouncedUpdate({ trailingDistancePercentShort: value.toString() })}
              indicatorInterval={effectiveValues.indicatorInterval as TimeInterval}
              onIndicatorIntervalChange={(interval) => debouncedUpdate({ indicatorInterval: interval })}
              useAdaptiveTrailing={effectiveValues.useAdaptiveTrailing}
              onUseAdaptiveTrailingChange={(enabled) => debouncedUpdate({ useAdaptiveTrailing: enabled })}
              trailingDistanceMode={effectiveValues.trailingDistanceMode}
              onTrailingDistanceModeChange={(mode) => debouncedUpdate({ trailingDistanceMode: mode })}
              trailingStopOffsetPercent={effectiveValues.trailingStopOffsetPercent}
              onTrailingStopOffsetPercentChange={(value) => debouncedUpdate({ trailingStopOffsetPercent: value.toString() })}
              isPending={updateMutation.isPending}
              activationModeLong={effectiveValues.activationModeLong}
              onActivationModeLongChange={(mode) => debouncedUpdate({ trailingActivationModeLong: mode })}
              activationModeShort={effectiveValues.activationModeShort}
              onActivationModeShortChange={(mode) => debouncedUpdate({ trailingActivationModeShort: mode })}
            />
          </Box>

          {useIndividualConfig && effectiveValues.activationModeLong === 'manual' && (
            <HStack justify="space-between" p={2} bg="green.subtle" borderRadius="md">
              <Text fontSize="xs" fontWeight="medium" color="green.600">
                {t('positionTrailingStop.activateTrailingLong')}
              </Text>
              <Switch
                checked={effectiveValues.manualTrailingActivatedLong}
                onCheckedChange={(checked) => debouncedUpdate({ manualTrailingActivatedLong: checked })}
                size="sm"
              />
            </HStack>
          )}

          {useIndividualConfig && effectiveValues.activationModeShort === 'manual' && (
            <HStack justify="space-between" p={2} bg="red.subtle" borderRadius="md">
              <Text fontSize="xs" fontWeight="medium" color="red.600">
                {t('positionTrailingStop.activateTrailingShort')}
              </Text>
              <Switch
                checked={effectiveValues.manualTrailingActivatedShort}
                onCheckedChange={(checked) => debouncedUpdate({ manualTrailingActivatedShort: checked })}
                size="sm"
              />
            </HStack>
          )}
        </VStack>
      </Popover>
    </Box>
  );
});

TrailingStopPopover.displayName = 'TrailingStopPopover';
