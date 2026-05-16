import { Box, Flex, HStack } from '@chakra-ui/react';
import { IconButton } from '@renderer/components/ui';
import { GridEditOverlay } from './GridEditOverlay';
import { TooltipWrapper } from './Tooltip';
import { memo, useCallback, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LuMaximize2, LuMinimize2, LuMinus } from 'react-icons/lu';

export type GridPanelMode = 'chart' | 'bare';
export type GridPanelWindowState = 'normal' | 'minimized' | 'maximized';

interface GridPanelBaseProps {
  /** Stable panel id used by react-grid-layout. */
  id: string;
  /**
   * Whether this panel is the focused one. The focus highlight border was
   * dropped since one symbol per layout makes the visual hint redundant —
   * the focusedPanelId tracking is still kept so the Confluence can follow
   * whichever chart the user clicked last.
   */
  isFocused: boolean;
  /** Window state for chart panels (min/max/normal). Bare panels stay 'normal'. */
  windowState?: GridPanelWindowState;
  onFocus: (id: string) => void;
  onClose?: (id: string) => void;
  /** Chart-mode-only — header window-state controls. */
  onMinimize?: (id: string) => void;
  onMaximize?: (id: string) => void;
  onRestore?: (id: string) => void;
  /**
   * v1.5 — when true, the panel body shows a translucent scrim + a
   * corner X close button (the `<GridEditOverlay>`). For bare panels
   * this replaces the v1.10 right-click context menu close, so close
   * is consistent across chart and bare panels.
   */
  editMode?: boolean;
  children: ReactNode;
}

interface ChartGridPanelProps extends GridPanelBaseProps {
  mode: 'chart';
  /** Chart panels render their title in the header. */
  header: ReactNode;
}

interface BareGridPanelProps extends GridPanelBaseProps {
  mode: 'bare';
  header?: never;
}

export type GridPanelProps = ChartGridPanelProps | BareGridPanelProps;

/**
 * Unified grid-panel shell for v1.10.
 *
 * - `mode="chart"` renders a header with title + min/max/close. The header
 *   is the drag handle. Right-click on the body is preserved for the chart's
 *   own context menu (drawing tools, etc.).
 * - `mode="bare"` is headerless. The body itself is the drag handle (via
 *   `data-grid-handle`). Right-click anywhere fires `onClose` via a
 *   single-item context menu — no other chrome.
 *
 * Both modes share: dark `bg.panel` background, accent focus border when
 * focused (and the parent grid has >1 panel), `border-radius: sm`, and a
 * resize handle inherited from `react-grid-layout`.
 */
export const GridPanel = memo((props: GridPanelProps) => {
  const { t } = useTranslation();
  const {
    id,
    windowState = 'normal',
    mode,
    onFocus,
    onClose,
    onMinimize,
    onMaximize,
    onRestore,
    editMode = false,
    children,
  } = props;

  const handleFocus = useCallback(() => onFocus(id), [onFocus, id]);

  const handleHeaderMinimize = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      onMinimize?.(id);
    },
    [onMinimize, id],
  );

  const handleHeaderToggleMax = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      if (windowState === 'maximized') onRestore?.(id);
      else onMaximize?.(id);
    },
    [onMaximize, onRestore, id, windowState],
  );

  const handleOverlayClose = useCallback(
    (closeId: string) => onClose?.(closeId),
    [onClose],
  );

  const isMaximized = windowState === 'maximized';

  const shell = (
    <Flex
      direction="column"
      h="100%"
      position="relative"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      borderRadius="sm"
      overflow="hidden"
      onMouseDown={handleFocus}
      data-panel-id={id}
      data-panel-mode={mode}
    >
      {mode === 'chart' && (
        <Flex
          className={editMode ? undefined : 'panel-drag-handle'}
          align="center"
          justify="space-between"
          h="24px"
          minH="24px"
          px={1}
          bg="transparent"
          borderBottom="1px solid"
          borderColor="border"
          cursor={editMode ? 'default' : 'grab'}
          userSelect="none"
        >
          <Box flex={1} overflow="hidden">
            {props.header}
          </Box>
          <HStack gap={0} flexShrink={0}>
            {onMinimize && (
              <TooltipWrapper label={t('common.minimize')} showArrow>
                <IconButton
                  aria-label={t('common.minimize')}
                  size="2xs"
                  variant="ghost"
                  onClick={handleHeaderMinimize}
                >
                  <LuMinus />
                </IconButton>
              </TooltipWrapper>
            )}
            {(onMaximize ?? onRestore) && (
              <TooltipWrapper
                label={isMaximized ? t('common.restore') : t('common.maximize')}
                showArrow
              >
                <IconButton
                  aria-label={isMaximized ? t('common.restore') : t('common.maximize')}
                  size="2xs"
                  variant="ghost"
                  onClick={handleHeaderToggleMax}
                >
                  {isMaximized ? <LuMinimize2 /> : <LuMaximize2 />}
                </IconButton>
              </TooltipWrapper>
            )}
          </HStack>
        </Flex>
      )}

      <Box
        flex={1}
        overflow="hidden"
        className={mode === 'bare' && !editMode ? 'panel-drag-handle' : undefined}
        cursor={mode === 'bare' && !editMode ? 'grab' : undefined}
      >
        {children}
      </Box>
      {editMode && onClose && (
        <GridEditOverlay panelId={id} onClose={handleOverlayClose} />
      )}
    </Flex>
  );

  return shell;
});

GridPanel.displayName = 'GridPanel';
