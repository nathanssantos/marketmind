import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { Button, FormRow, Popover, Switch, TooltipWrapper } from '@renderer/components/ui';
import { useChartLayersStore, type ChartLayerFlags } from '@renderer/store/chartLayersStore';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { isChartPanel } from '@shared/types/layout';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuLayers, LuPencil, LuActivity, LuChartLine, LuFlame } from 'react-icons/lu';

const DEFAULT_FLAGS: ChartLayerFlags = {
  drawings: true,
  indicators: true,
  orderLines: true,
  setupMarkers: true,
  heatmap: true,
};

interface LayerRow {
  key: keyof ChartLayerFlags;
  icon: React.ReactNode;
  labelKey: string;
}

const LAYER_ROWS: LayerRow[] = [
  { key: 'drawings', icon: <LuPencil />, labelKey: 'chart.layers.drawings' },
  { key: 'indicators', icon: <LuActivity />, labelKey: 'chart.layers.indicators' },
  { key: 'orderLines', icon: <LuChartLine />, labelKey: 'chart.layers.orderLines' },
  { key: 'heatmap', icon: <LuFlame />, labelKey: 'chart.layers.heatmap' },
];

export const LayersTogglePopover = memo(() => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // Read primitives separately — returning a new object from the
  // selector creates a fresh reference every store update and triggers
  // an infinite re-render loop (saw "Maximum update depth exceeded" on
  // first focus).
  const focusedPanelId = useLayoutStore((s) => s.focusedPanelId);
  const activeLayoutId = useLayoutStore((s) => s.activeLayoutId);
  const activeSymbolTabId = useLayoutStore((s) => s.activeSymbolTabId);
  const layoutPresets = useLayoutStore((s) => s.layoutPresets);
  const symbolTabs = useLayoutStore((s) => s.symbolTabs);

  const focusedPanelKey = useMemo<{ symbol: string; interval: string } | null>(() => {
    if (!focusedPanelId) return null;
    const layout = layoutPresets.find((l) => l.id === activeLayoutId);
    if (!layout) return null;
    const panel = layout.grid.find((p) => p.id === focusedPanelId);
    if (!panel || !isChartPanel(panel)) return null;
    const tab = symbolTabs.find((tt) => tt.id === activeSymbolTabId);
    if (!tab) return null;
    return { symbol: tab.symbol, interval: panel.timeframe };
  }, [focusedPanelId, activeLayoutId, activeSymbolTabId, layoutPresets, symbolTabs]);

  const flagsKey = focusedPanelKey ? `${focusedPanelKey.symbol}:${focusedPanelKey.interval}` : '';
  const storedFlags = useChartLayersStore((s) => (flagsKey ? s.flagsByKey[flagsKey] : undefined));
  const flags = focusedPanelKey ? (storedFlags ?? DEFAULT_FLAGS) : null;
  const toggleFlag = useChartLayersStore((s) => s.toggleFlag);

  const setAll = useCallback(
    (visible: boolean) => {
      if (!focusedPanelKey) return;
      for (const row of LAYER_ROWS) {
        useChartLayersStore.getState().setFlag(focusedPanelKey.symbol, focusedPanelKey.interval, row.key, visible);
      }
    },
    [focusedPanelKey],
  );

  const allOn = useMemo(() => {
    if (!flags) return false;
    return LAYER_ROWS.every((r) => flags[r.key]);
  }, [flags]);

  const disabled = !focusedPanelKey || !flags;

  return (
    <Popover
      open={isOpen}
      onOpenChange={(e) => setIsOpen(e.open)}
      showArrow={false}
      width="320px"
      positioning={{ placement: 'bottom-start', offset: { mainAxis: 8 } }}
      trigger={
        <Flex>
          <TooltipWrapper
            label={t('chart.layers.configure')}
            showArrow
            placement="bottom"
            isDisabled={isOpen}
          >
            <Button
              aria-label={t('chart.layers.configure')}
              size="2xs"
              variant="outline"
              color="fg.muted"
              data-testid="toolbar-layers-button"
            >
              <LuLayers />
              {t('chart.layers.title')}
            </Button>
          </TooltipWrapper>
        </Flex>
      }
    >
      <Box p={3}>
        <Stack gap={3}>
          <Flex justify="space-between" align="center">
            <Text fontSize="sm" fontWeight="semibold">
              {t('chart.layers.title')}
            </Text>
            <Button
              size="2xs"
              variant="ghost"
              disabled={disabled}
              onClick={() => setAll(!allOn)}
            >
              {allOn ? t('chart.layers.hideAll') : t('chart.layers.showAll')}
            </Button>
          </Flex>

          {disabled ? (
            <Text fontSize="xs" color="fg.muted" py={2} textAlign="center">
              {t('chart.layers.noFocusedChart')}
            </Text>
          ) : (
            <Stack gap={2}>
              {LAYER_ROWS.map((row) => (
                <FormRow
                  key={row.key}
                  label={
                    <Flex align="center" gap={2}>
                      <Box color="fg.muted">{row.icon}</Box>
                      <Text fontSize="xs">{t(row.labelKey)}</Text>
                    </Flex>
                  }
                >
                  <Switch
                    checked={flags?.[row.key] ?? true}
                    onCheckedChange={() => {
                      if (!focusedPanelKey) return;
                      toggleFlag(focusedPanelKey.symbol, focusedPanelKey.interval, row.key);
                    }}
                    aria-label={t(row.labelKey)}
                    data-testid={`layers-toggle-${row.key}`}
                  />
                </FormRow>
              ))}
            </Stack>
          )}
        </Stack>
      </Box>
    </Popover>
  );
});

LayersTogglePopover.displayName = 'LayersTogglePopover';
