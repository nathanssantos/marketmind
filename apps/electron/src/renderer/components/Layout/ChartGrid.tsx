import { Box, Portal } from '@chakra-ui/react';
import { IconButton, Menu } from '@renderer/components/ui';
import { GridLayout, useContainerWidth } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { LuPlus } from 'react-icons/lu';
import { ChartGridPanel } from './ChartGridPanel';
import type { GridPanelConfig } from '@shared/types/layout';
import { DEFAULT_GRID_COLS, DEFAULT_ROW_HEIGHT, GRID_MARGIN, GRID_CONTAINER_PADDING } from '@shared/types/layout';

const buildLayoutItem = (panel: GridPanelConfig) => ({
  i: panel.id,
  x: panel.gridPosition.x,
  y: panel.gridPosition.y,
  w: panel.gridPosition.w,
  h: panel.gridPosition.h,
});

function ChartGridComponent() {
  const activeLayout = useLayoutStore(s => s.getActiveLayout());
  const activeTab = useLayoutStore(s => s.getActiveTab());
  const updatePanelGridPosition = useLayoutStore(s => s.updatePanelGridPosition);
  const setFocusedPanel = useLayoutStore(s => s.setFocusedPanel);
  const focusedPanelId = useLayoutStore(s => s.focusedPanelId);
  const addPanel = useLayoutStore(s => s.addPanel);

  const { width: containerWidth, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });

  const [containerHeight, setContainerHeight] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setContainerHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  const maximizedPanel = useMemo(
    () => activeLayout?.grid.find(p => p.windowState === 'maximized'),
    [activeLayout],
  );

  const visiblePanels = useMemo(
    () => activeLayout?.grid.filter(p => p.windowState !== 'minimized') ?? [],
    [activeLayout],
  );

  const maxRow = useMemo(() => {
    const panels = maximizedPanel ? [maximizedPanel] : visiblePanels;
    let max = 0;
    for (const p of panels) {
      const bottom = p.gridPosition.y + p.gridPosition.h;
      if (bottom > max) max = bottom;
    }
    return Math.max(max, 1);
  }, [maximizedPanel, visiblePanels]);

  const dynamicRowHeight = useMemo(() => {
    if (containerHeight <= 0 || maxRow <= 0) return DEFAULT_ROW_HEIGHT;
    const totalMargin = GRID_MARGIN[1] * (maxRow - 1);
    return Math.floor((containerHeight - totalMargin) / maxRow);
  }, [containerHeight, maxRow]);

  const gridLayout = useMemo((): Layout => {
    if (maximizedPanel) {
      const fullRows = Math.max(1, Math.floor(containerHeight / (dynamicRowHeight + GRID_MARGIN[1])));
      return [{
        i: maximizedPanel.id,
        x: 0, y: 0,
        w: DEFAULT_GRID_COLS, h: fullRows,
        static: true,
      }];
    }
    return visiblePanels.map(buildLayoutItem);
  }, [maximizedPanel, visiblePanels, containerHeight, dynamicRowHeight]);

  const handleLayoutChange = useCallback(
    (layout: Layout) => {
      if (!activeLayout || maximizedPanel) return;
      for (const item of layout) {
        const panel = activeLayout.grid.find(p => p.id === item.i);
        if (!panel) continue;
        const { x, y, w, h } = item;
        const pos = panel.gridPosition;
        if (pos.x === x && pos.y === y && pos.w === w && pos.h === h) continue;
        updatePanelGridPosition(activeLayout.id, item.i, { x, y, w, h });
      }
    },
    [activeLayout, maximizedPanel, updatePanelGridPosition],
  );

  const isSinglePanel = visiblePanels.length === 1;
  useEffect(() => {
    if (!isSinglePanel) return;
    const singleId = visiblePanels[0]?.id;
    if (singleId && focusedPanelId !== singleId) setFocusedPanel(singleId);
  }, [isSinglePanel, visiblePanels, focusedPanelId, setFocusedPanel]);

  const handleAddPanel = useCallback((timeframe: string) => {
    if (!activeLayout) return;
    addPanel(activeLayout.id, timeframe);
  }, [activeLayout, addPanel]);

  if (!activeLayout || !activeTab) return null;

  const panelsToRender = maximizedPanel ? [maximizedPanel] : visiblePanels;

  return (
    <Box ref={containerRef} w="100%" h="100%" overflow="hidden" position="relative">
      {mounted && containerWidth > 0 && (
        <GridLayout
          layout={gridLayout}
          width={containerWidth}
          gridConfig={{
            cols: DEFAULT_GRID_COLS,
            rowHeight: dynamicRowHeight,
            margin: GRID_MARGIN,
            containerPadding: GRID_CONTAINER_PADDING,
          }}
          dragConfig={{
            enabled: !maximizedPanel,
            handle: '.panel-drag-handle',
          }}
          resizeConfig={{
            enabled: !maximizedPanel,
            handles: ['s', 'e', 'se', 'sw', 'w', 'n', 'ne', 'nw'],
          }}
          onLayoutChange={handleLayoutChange}
        >
          {panelsToRender.map(panel => (
            <Box key={panel.id} h="100%">
              <ChartGridPanel
                panelConfig={panel}
                symbol={activeTab.symbol}
                marketType={activeTab.marketType}
                layoutId={activeLayout.id}
                isSinglePanel={isSinglePanel}
              />
            </Box>
          ))}
        </GridLayout>
      )}
      {!maximizedPanel && (
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton
              aria-label="Add chart"
              size="xs"
              variant="outline"
              position="absolute"
              bottom={2}
              right={2}
              zIndex={10}
              borderRadius="full"
              opacity={0.6}
              _hover={{ opacity: 1 }}
            >
              <LuPlus />
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item value="1m" onClick={() => handleAddPanel('1m')}>1m</Menu.Item>
                <Menu.Item value="5m" onClick={() => handleAddPanel('5m')}>5m</Menu.Item>
                <Menu.Item value="15m" onClick={() => handleAddPanel('15m')}>15m</Menu.Item>
                <Menu.Item value="30m" onClick={() => handleAddPanel('30m')}>30m</Menu.Item>
                <Menu.Item value="1h" onClick={() => handleAddPanel('1h')}>1h</Menu.Item>
                <Menu.Item value="4h" onClick={() => handleAddPanel('4h')}>4h</Menu.Item>
                <Menu.Item value="1d" onClick={() => handleAddPanel('1d')}>1d</Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      )}
    </Box>
  );
}

export const ChartGrid = memo(ChartGridComponent);
