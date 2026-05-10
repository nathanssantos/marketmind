import { Flex, Text } from '@chakra-ui/react';
import { Button, Popover, PopoverList, PopoverListHeader, PopoverToggleItem, TooltipWrapper } from '@renderer/components/ui';
import { useChartLayersStore, type ChartLayerFlags } from '@renderer/store/chartLayersStore';
import { useLayoutStore } from '@renderer/store/layoutStore';
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

  const focusedPanelId = useLayoutStore((s) => s.focusedPanelId);
  const storedFlags = useChartLayersStore((s) => (focusedPanelId ? s.flagsByPanelId[focusedPanelId] : undefined));
  const flags = focusedPanelId ? (storedFlags ?? DEFAULT_FLAGS) : null;
  const toggleFlag = useChartLayersStore((s) => s.toggleFlag);

  const setAll = useCallback(
    (visible: boolean) => {
      if (!focusedPanelId) return;
      for (const row of LAYER_ROWS) {
        useChartLayersStore.getState().setFlag(focusedPanelId, row.key, visible);
      }
    },
    [focusedPanelId],
  );

  const allOn = useMemo(() => {
    if (!flags) return false;
    return LAYER_ROWS.every((r) => flags[r.key]);
  }, [flags]);

  const disabled = !focusedPanelId || !flags;

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
              fontWeight="medium"
              gap={1.5}
              data-testid="toolbar-layers-button"
            >
              <LuLayers />
              {t('chart.layers.title')}
            </Button>
          </TooltipWrapper>
        </Flex>
      }
    >
      <PopoverList p={2}>
        <PopoverListHeader
          title={t('chart.layers.title')}
          action={
            <Button
              size="2xs"
              variant="ghost"
              disabled={disabled}
              onClick={() => setAll(!allOn)}
            >
              {allOn ? t('chart.layers.hideAll') : t('chart.layers.showAll')}
            </Button>
          }
        />
        {disabled ? (
          <Text fontSize="xs" color="fg.muted" py={2} textAlign="center">
            {t('chart.layers.noFocusedChart')}
          </Text>
        ) : (
          LAYER_ROWS.map((row) => (
            <PopoverToggleItem
              key={row.key}
              icon={row.icon}
              label={t(row.labelKey)}
              checked={flags?.[row.key] ?? true}
              onCheckedChange={() => {
                if (!focusedPanelId) return;
                toggleFlag(focusedPanelId, row.key);
              }}
              data-testid={`layers-toggle-${row.key}`}
            />
          ))
        )}
      </PopoverList>
    </Popover>
  );
});

LayersTogglePopover.displayName = 'LayersTogglePopover';
