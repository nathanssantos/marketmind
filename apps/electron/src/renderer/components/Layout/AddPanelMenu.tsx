import { Box, Portal } from '@chakra-ui/react';
import { IconButton, Menu, TooltipWrapper } from '@renderer/components/ui';
import {
  PANEL_GROUP_LABEL_KEYS,
  groupedPanelDefs,
  type PanelDef,
} from '@renderer/grid/panel-registry';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChartCandlestick, LuPlus } from 'react-icons/lu';

const TIMEFRAME_OPTIONS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'] as const;

/**
 * v1.10 Track 3 — `+ Add panel` header dropdown driven by the panel
 * registry.
 *
 * Charts: one entry per timeframe (multi-instance, no greying).
 * Every other registered panel kind: single-instance, greyed out when
 * already on the active layout.
 *
 * Replaces the v1-era `+` chart-only dropdown in `Toolbar.tsx`.
 */
export const AddPanelMenu = memo(() => {
  const { t } = useTranslation();
  const activeLayout = useLayoutStore((s) => s.getActiveLayout());
  const addPanel = useLayoutStore((s) => s.addPanel);
  const addNamedPanel = useLayoutStore((s) => s.addNamedPanel);

  const handleAddChart = useCallback(
    (timeframe: string) => {
      if (activeLayout) addPanel(activeLayout.id, timeframe);
    },
    [activeLayout, addPanel],
  );

  const handleAddNamed = useCallback(
    (def: PanelDef) => {
      if (!activeLayout || def.kind === 'chart') return;
      addNamedPanel(activeLayout.id, def.kind);
    },
    [activeLayout, addNamedPanel],
  );

  const groups = groupedPanelDefs();

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Box>
          <TooltipWrapper label={t('panels.addPanel')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('panels.addPanel')}
              variant="outline"
              color="fg.muted"
              data-testid="add-panel-button"
            >
              <LuPlus />
            </IconButton>
          </TooltipWrapper>
        </Box>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content data-testid="add-panel-menu" minW="200px">
            {groups.map(({ group, defs }) => {
              if (defs.length === 0) return null;
              return (
                <Menu.ItemGroup key={group}>
                  <Menu.ItemGroupLabel>
                    {t(PANEL_GROUP_LABEL_KEYS[group])}
                  </Menu.ItemGroupLabel>
                  {group === 'charts' ? (
                    TIMEFRAME_OPTIONS.map((tf) => (
                      <Menu.Item
                        key={`chart-${tf}`}
                        value={`chart-${tf}`}
                        onClick={() => handleAddChart(tf)}
                        data-testid={`add-panel-chart-${tf}`}
                      >
                        <LuChartCandlestick />
                        {t('panels.chart.title')} · {tf}
                      </Menu.Item>
                    ))
                  ) : (
                    defs.map((def) => {
                      const alreadyOnGrid = !!activeLayout?.grid.some((p) => p.kind === def.kind);
                      return (
                        <Menu.Item
                          key={def.kind}
                          value={def.kind}
                          disabled={alreadyOnGrid}
                          onClick={alreadyOnGrid ? undefined : () => handleAddNamed(def)}
                          data-testid={`add-panel-${def.kind}`}
                        >
                          <def.icon />
                          {t(def.titleKey)}
                          {alreadyOnGrid && (
                            <Box as="span" ml="auto" fontSize="2xs" color="fg.muted">
                              ✓
                            </Box>
                          )}
                        </Menu.Item>
                      );
                    })
                  )}
                </Menu.ItemGroup>
              );
            })}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
});

AddPanelMenu.displayName = 'AddPanelMenu';
