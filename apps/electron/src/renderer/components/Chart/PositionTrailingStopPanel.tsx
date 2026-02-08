import { Switch } from '@/renderer/components/ui/switch';
import { Box, Collapsible, HStack, Text, VStack } from '@chakra-ui/react';
import { useUIStore } from '@renderer/store/uiStore';
import { trpc } from '@renderer/utils/trpc';
import type { ReactElement } from 'react';
import { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';
import { TrailingStopSection } from '../Trading/WatcherManager/TrailingStopSection';

interface PositionTrailingStopPanelProps {
  symbol: string;
  walletId: string;
}

export const PositionTrailingStopPanel = ({ symbol, walletId }: PositionTrailingStopPanelProps): ReactElement => {
  const { t } = useTranslation();
  const expanded = useUIStore((s) => s.trailingStopPanelExpanded);
  const togglePanel = useUIStore((s) => s.toggleTrailingStopPanel);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const { data: symbolConfig } = trpc.trading.getSymbolTrailingConfig.useQuery(
    { walletId, symbol },
    { refetchInterval: 30000 }
  );

  const { data: walletConfig } = trpc.autoTrading.getConfig.useQuery(
    { walletId },
    { refetchInterval: 30000 }
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

  return (
    <Box
      position="absolute"
      top={2}
      right="80px"
      zIndex={10}
      w="260px"
      bg="bg.panel"
      borderRadius="md"
      border="1px solid"
      borderColor="border"
      boxShadow="sm"
      overflow="hidden"
    >
      <HStack
        justify="space-between"
        px={2}
        py={1.5}
        borderBottom={expanded ? '1px solid' : 'none'}
        borderColor="border"
        cursor="pointer"
        onClick={togglePanel}
        _hover={{ bg: 'bg.surface' }}
        borderTopRadius="md"
      >
        <Text fontSize="xs" fontWeight="semibold" color="fg">
          {t('positionTrailingStop.title')} - {symbol}
        </Text>
        {expanded ? <LuChevronUp size={12} /> : <LuChevronDown size={12} />}
      </HStack>

      <Collapsible.Root open={expanded}>
        <Collapsible.Content>
          <VStack gap={2} p={2} align="stretch">
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
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};
