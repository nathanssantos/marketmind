import { Switch } from '@/renderer/components/ui/switch';
import { Box, Flex, HStack, IconButton, Text, VStack } from '@chakra-ui/react';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { trpc } from '@renderer/utils/trpc';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuShield } from 'react-icons/lu';
import { TrailingStopSection } from '../Trading/WatcherManager/TrailingStopSection';
import { Popover } from '../ui/popover';
import { TooltipWrapper } from '../ui/Tooltip';

interface TrailingStopPopoverProps {
  symbol: string;
}

export const TrailingStopPopover = memo(({ symbol }: TrailingStopPopoverProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const { activeWallet } = useActiveWallet();
  const walletId = activeWallet?.id ?? '';

  const { data: executions } = trpc.autoTrading.getActiveExecutions.useQuery(
    { walletId, limit: 50 },
    { enabled: !!walletId && !!symbol, refetchInterval: 10000 }
  );

  const hasOpenPositionWithStop = useMemo(
    () => executions?.some(e => e.symbol === symbol && e.status === 'open' && e.stopLoss) ?? false,
    [executions, symbol]
  );

  const { data: symbolConfig } = trpc.trading.getSymbolTrailingConfig.useQuery(
    { walletId, symbol },
    { enabled: !!walletId && hasOpenPositionWithStop, refetchInterval: 30000 }
  );

  const { data: walletConfig } = trpc.autoTrading.getConfig.useQuery(
    { walletId },
    { enabled: !!walletId && hasOpenPositionWithStop, refetchInterval: 30000 }
  );

  const utils = trpc.useUtils();

  const updateMutation = trpc.trading.updateSymbolTrailingConfig.useMutation({
    onSuccess: () => {
      void utils.trading.getSymbolTrailingConfig.invalidate({ walletId, symbol });
    },
  });

  const mutateRef = useRef(updateMutation.mutate);
  mutateRef.current = updateMutation.mutate;

  const debouncedUpdate = useCallback((fields: Record<string, unknown>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      mutateRef.current({ walletId, symbol, ...fields });
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
        useProfitLockDistance: symbolConfig.useProfitLockDistance ?? walletConfig?.useProfitLockDistance ?? false,
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
      useProfitLockDistance: walletConfig?.useProfitLockDistance ?? false,
    };
  }, [symbolConfig, walletConfig, useIndividualConfig]);

  if (!walletId || !hasOpenPositionWithStop) return null;

  return (
    <Popover
      open={isOpen}
      onOpenChange={(e) => setIsOpen(e.open)}
      showArrow={false}
      width="280px"
      positioning={{ placement: 'bottom-end', offset: { mainAxis: 8 } }}
      trigger={
        <Flex>
          <TooltipWrapper
            label={t('positionTrailingStop.title')}
            showArrow
            placement="bottom"
            isDisabled={isOpen}
          >
            <IconButton
              aria-label={t('positionTrailingStop.title')}
              size="2xs"
              variant={isOpen ? 'solid' : 'ghost'}
              colorPalette="blue"
            >
              <LuShield />
            </IconButton>
          </TooltipWrapper>
        </Flex>
      }
    >
      <VStack gap={2} p={3} align="stretch">
        <Text fontSize="xs" fontWeight="semibold" color="fg">
          {t('positionTrailingStop.title')} - {symbol}
        </Text>

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
            useAdaptiveTrailing={effectiveValues.useAdaptiveTrailing}
            onUseAdaptiveTrailingChange={(enabled) => debouncedUpdate({ useAdaptiveTrailing: enabled })}
            useProfitLockDistance={effectiveValues.useProfitLockDistance}
            onUseProfitLockDistanceChange={(enabled) => debouncedUpdate({ useProfitLockDistance: enabled })}
            isPending={updateMutation.isPending}
          />
        </Box>
      </VStack>
    </Popover>
  );
});

TrailingStopPopover.displayName = 'TrailingStopPopover';
