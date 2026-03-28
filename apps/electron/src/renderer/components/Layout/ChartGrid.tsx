import { Box } from '@chakra-ui/react';
import { GridLayout, useContainerWidth } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
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

  const totalRows = useMemo(
    () => Math.max(1, Math.floor(containerHeight / (DEFAULT_ROW_HEIGHT + GRID_MARGIN[1]))),
    [containerHeight],
  );

  const gridLayout = useMemo((): Layout => {
    if (maximizedPanel) return [{
      i: maximizedPanel.id,
      x: 0, y: 0,
      w: DEFAULT_GRID_COLS, h: totalRows,
      static: true,
    }];
    return visiblePanels.map(buildLayoutItem);
  }, [maximizedPanel, visiblePanels, totalRows]);

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

  if (!activeLayout || !activeTab) return null;

  const panelsToRender = maximizedPanel ? [maximizedPanel] : visiblePanels;

  return (
    <Box ref={containerRef} w="100%" h="100%" overflow="hidden">
      {mounted && containerWidth > 0 && (
        <GridLayout
          layout={gridLayout}
          width={containerWidth}
          gridConfig={{
            cols: DEFAULT_GRID_COLS,
            rowHeight: DEFAULT_ROW_HEIGHT,
            margin: GRID_MARGIN,
            containerPadding: GRID_CONTAINER_PADDING,
          }}
          dragConfig={{
            enabled: !maximizedPanel,
            handle: '.panel-drag-handle',
          }}
          resizeConfig={{
            enabled: !maximizedPanel,
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
              />
            </Box>
          ))}
        </GridLayout>
      )}
    </Box>
  );
}

export const ChartGrid = memo(ChartGridComponent);
