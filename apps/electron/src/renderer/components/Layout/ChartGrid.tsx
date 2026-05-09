import { Box } from '@chakra-ui/react';
import { GridLayout, useContainerWidth } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ChartGridPanel } from './ChartGridPanel';
import { NamedPanelRenderer } from './NamedPanelRenderer';
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
  const activeLayoutId = useLayoutStore(s => s.activeLayoutId);
  const layoutPresets = useLayoutStore(s => s.layoutPresets);
  const activeTab = useMemo(
    () => symbolTabs.find(t => t.id === activeSymbolTabId),
    [symbolTabs, activeSymbolTabId],
  );
  const activeLayout = useMemo(
    () => layoutPresets.find(l => l.id === activeLayoutId),
    [activeLayoutId, layoutPresets],
  );
  const gridEditMode = useLayoutStore(s => s.gridEditMode);
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

  // v1.10 Track 2 — grid uses a fixed row height so panels have stable
  // pixel heights. The container scrolls vertically when content exceeds
  // viewport, and panels can be resized larger than the viewport.
  const gridLayout = useMemo((): Layout => {
    if (maximizedPanel) {
      const fullRows = Math.max(
        1,
        Math.floor(containerHeight / (DEFAULT_ROW_HEIGHT + GRID_MARGIN[1])),
      );
      return [{
        i: maximizedPanel.id,
        x: 0, y: 0,
        w: DEFAULT_GRID_COLS, h: fullRows,
        static: true,
      }];
    }
    return visiblePanels.map(buildLayoutItem);
  }, [maximizedPanel, visiblePanels, containerHeight]);

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
    <Box
      ref={containerRef}
      className={gridEditMode ? 'grid--edit-mode' : 'grid--locked'}
      w="100%"
      h="100%"
      overflowX="hidden"
      overflowY={maximizedPanel ? 'hidden' : 'auto'}
      position="relative"
      css={{
        '&.grid--locked .react-resizable-handle': {
          display: 'none',
        },
        '&.grid--locked .panel-drag-handle': {
          cursor: 'default',
        },
        '&.grid--edit-mode .react-resizable-handle': {
          width: '24px',
          height: '24px',
          padding: '0 4px 4px 0',
          opacity: 0.7,
          // White corner-arrow icon — replaces the dim grey default.
          // RGL applies its own `transform: rotate()` per handle to
          // point the arrow at the correct edge; we must NOT use
          // transform on hover or the rotation snaps to 0deg.
          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><path d='M11 11L11 3L9 3L9 9L3 9L3 11Z' fill='white' opacity='0.95'/></svg>\")",
          backgroundSize: '12px 12px',
          backgroundPosition: 'bottom right',
          backgroundRepeat: 'no-repeat',
          filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.7))',
          zIndex: 101,
          transition: 'opacity 0.15s, filter 0.15s',
        },
        '&.grid--edit-mode .react-resizable-handle:hover': {
          opacity: 1,
          filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.6))',
        },
      }}
    >
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
            enabled: gridEditMode && !maximizedPanel,
            handle: '.panel-drag-handle',
          }}
          resizeConfig={{
            enabled: gridEditMode && !maximizedPanel,
            handles: ['s', 'e', 'se', 'sw', 'w', 'n', 'ne', 'nw'],
          }}
          onLayoutChange={handleLayoutChange}
        >
          {panelsToRender.map(panel => (
            <Box key={panel.id} h="100%">
              {isChartPanel(panel) ? (
                <ChartGridPanel
                  panelConfig={panel}
                  symbol={activeTab.symbol}
                  marketType={activeTab.marketType}
                  layoutId={activeLayout.id}
                  isSinglePanel={isSinglePanel}
                />
              ) : (
                <NamedPanelRenderer
                  panelConfig={panel}
                  layoutId={activeLayout.id}
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
