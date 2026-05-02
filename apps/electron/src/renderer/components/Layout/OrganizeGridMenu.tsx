import { Box, Portal } from '@chakra-ui/react';
import { IconButton, Menu, TooltipWrapper } from '@renderer/components/ui';
import { useLayoutStore } from '@renderer/store/layoutStore';
import type { GridPanelConfig } from '@shared/types/layout';
import { DEFAULT_GRID_COLS } from '@shared/types/layout';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LuColumns3, LuLayoutGrid, LuRows3 } from 'react-icons/lu';

type OrganizeAlgorithm = 'compact' | 'columns' | 'rows';

/**
 * v1.10 Track 3 — `Organize grid` header dropdown. Applies a layout
 * algorithm to all visible panels in the active layout, preserving each
 * panel's identity (no add/remove). Maximized panels are skipped (their
 * geometry is overridden by the chart's full-screen render path).
 */
export const OrganizeGridMenu = memo(() => {
  const { t } = useTranslation();
  const activeLayout = useLayoutStore((s) => s.getActiveLayout());
  const updateGridLayout = useLayoutStore((s) => s.updateGridLayout);

  const handleOrganize = useCallback(
    (algo: OrganizeAlgorithm) => {
      if (!activeLayout) return;
      const visible = activeLayout.grid.filter((p) => p.windowState !== 'minimized');
      if (visible.length === 0) return;
      const minimized = activeLayout.grid.filter((p) => p.windowState === 'minimized');
      const arranged = arrange(visible, algo);
      updateGridLayout(activeLayout.id, [...arranged, ...minimized]);
    },
    [activeLayout, updateGridLayout],
  );

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Box>
          <TooltipWrapper label={t('panels.organize')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('panels.organize')}
              variant="ghost"
              color="fg.muted"
              data-testid="organize-grid-button"
            >
              <LuLayoutGrid />
            </IconButton>
          </TooltipWrapper>
        </Box>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content data-testid="organize-grid-menu" minW="180px">
            <Menu.Item
              value="compact"
              onClick={() => handleOrganize('compact')}
              data-testid="organize-compact"
            >
              <LuLayoutGrid />
              {t('panels.organizeCompact')}
            </Menu.Item>
            <Menu.Item
              value="columns"
              onClick={() => handleOrganize('columns')}
              data-testid="organize-columns"
            >
              <LuColumns3 />
              {t('panels.organizeColumns')}
            </Menu.Item>
            <Menu.Item
              value="rows"
              onClick={() => handleOrganize('rows')}
              data-testid="organize-rows"
            >
              <LuRows3 />
              {t('panels.organizeRows')}
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
});

OrganizeGridMenu.displayName = 'OrganizeGridMenu';

const COMPACT_ROWS_PER_PANEL = 12;
const ROWS_HEIGHT = 16;

const arrange = (
  panels: GridPanelConfig[],
  algo: OrganizeAlgorithm,
): GridPanelConfig[] => {
  if (algo === 'columns') return arrangeColumns(panels);
  if (algo === 'rows') return arrangeRows(panels);
  return arrangeCompact(panels);
};

/**
 * Compact: snap-to-top-left preserving each panel's order. Panels are
 * placed left-to-right, wrapping to a new row when the next panel won't
 * fit in the current row's remaining columns.
 */
const arrangeCompact = (panels: GridPanelConfig[]): GridPanelConfig[] => {
  let cursorX = 0;
  let cursorY = 0;
  let rowMaxH = 0;
  return panels.map((p) => {
    const w = Math.min(p.gridPosition.w, DEFAULT_GRID_COLS);
    const h = p.gridPosition.h;
    if (cursorX + w > DEFAULT_GRID_COLS) {
      cursorX = 0;
      cursorY += rowMaxH;
      rowMaxH = 0;
    }
    const next = { ...p, gridPosition: { x: cursorX, y: cursorY, w, h } };
    cursorX += w;
    if (h > rowMaxH) rowMaxH = h;
    return next;
  });
};

/** Columns: each panel becomes a vertical column of equal width. */
const arrangeColumns = (panels: GridPanelConfig[]): GridPanelConfig[] => {
  const n = panels.length;
  const colWidth = Math.max(1, Math.floor(DEFAULT_GRID_COLS / n));
  return panels.map((p, i) => ({
    ...p,
    gridPosition: {
      x: i * colWidth,
      y: 0,
      w: colWidth,
      h: COMPACT_ROWS_PER_PANEL * 2,
    },
  }));
};

/** Rows: each panel becomes a horizontal full-width row. */
const arrangeRows = (panels: GridPanelConfig[]): GridPanelConfig[] => {
  return panels.map((p, i) => ({
    ...p,
    gridPosition: {
      x: 0,
      y: i * ROWS_HEIGHT,
      w: DEFAULT_GRID_COLS,
      h: ROWS_HEIGHT,
    },
  }));
};
