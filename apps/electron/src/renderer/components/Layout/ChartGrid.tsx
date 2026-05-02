import { Box } from '@chakra-ui/react';
import { GridLayout, useContainerWidth } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ChartGridPanel } from './ChartGridPanel';
import type { GridPanelConfig } from '@shared/types/layout';
import { DEFAULT_GRID_COLS, DEFAULT_ROW_HEIGHT, GRID_MARGIN, GRID_CONTAINER_PADDING, isChartPanel } from '@shared/types/layout';

const buildLayoutItem = (panel: GridPanelConfig) => ({
  i: panel.id,
  x: panel.gridPosition.x,
  y: panel.gridPosition.y,
  w: panel.gridPosition.w,
  h: panel.gridPosition.h,
});

function ChartGridComponent() {
  const symbolTabs = useLayoutStore(s => s.symbolTabs);
  const activeSymbolTabId = useLayoutStore(s => s.activeSymbolTabId);
  const layoutPresets = useLayoutStore(s => s.layoutPresets);
  const activeTab = useMemo(
    () => symbolTabs.find(t => t.id === activeSymbolTabId),
    [symbolTabs, activeSymbolTabId],
  );
  const activeLayout = useMemo(
    () => activeTab ? layoutPresets.find(l => l.id === activeTab.activeLayoutId) : undefined,
    [activeTab, layoutPresets],
  );
  const updatePanelGridPosition = useLayoutStore(s => s.updatePanelGridPosition);
  const setFocusedPanel = useLayoutStore(s => s.setFocusedPanel);
  const focusedPanelId = useLayoutStore(s => s.focusedPanelId);

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
              {isChartPanel(panel) && (
                <ChartGridPanel
                  panelConfig={panel}
                  symbol={activeTab.symbol}
                  marketType={activeTab.marketType}
                  layoutId={activeLayout.id}
                  isSinglePanel={isSinglePanel}
                />
              )}
            </Box>
          ))}
        </GridLayout>
      )}
    </Box>
  );
}

export const ChartGrid = memo(ChartGridComponent);
