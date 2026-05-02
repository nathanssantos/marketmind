import { Box, Flex, HStack, Portal } from '@chakra-ui/react';
import { IconButton, Menu } from '@renderer/components/ui';
import { TooltipWrapper } from './Tooltip';
import { memo, useCallback, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LuMaximize2, LuMinimize2, LuMinus, LuX } from 'react-icons/lu';

export type GridPanelMode = 'chart' | 'bare';
export type GridPanelWindowState = 'normal' | 'minimized' | 'maximized';

interface GridPanelBaseProps {
  /** Stable panel id used by react-grid-layout. */
  id: string;
  /** Whether this panel is the focused one (drives accent border). */
  isFocused: boolean;
  /** Whether the parent grid has more than one panel (drives focus-border visibility). */
  showFocusBorder?: boolean;
  /** Window state for chart panels (min/max/normal). Bare panels stay 'normal'. */
  windowState?: GridPanelWindowState;
  onFocus: (id: string) => void;
  onClose?: (id: string) => void;
  /** Chart-mode-only — header window-state controls. */
  onMinimize?: (id: string) => void;
  onMaximize?: (id: string) => void;
  onRestore?: (id: string) => void;
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
    isFocused,
    showFocusBorder = true,
    windowState = 'normal',
    mode,
    onFocus,
    onClose,
    onMinimize,
    onMaximize,
    onRestore,
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

  const handleHeaderClose = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      onClose?.(id);
    },
    [onClose, id],
  );

  const handleContextMenuClose = useCallback(() => onClose?.(id), [onClose, id]);

  const isMaximized = windowState === 'maximized';
  const focusBorder = isFocused && showFocusBorder ? 'accent.solid' : 'border';

  const shell = (
    <Flex
      direction="column"
      h="100%"
      bg="bg.panel"
      borderWidth="1px"
      borderColor={focusBorder}
      borderRadius="sm"
      overflow="hidden"
      onMouseDown={handleFocus}
      data-panel-id={id}
      data-panel-mode={mode}
    >
      {mode === 'chart' && (
        <Flex
          className="panel-drag-handle"
          align="center"
          justify="space-between"
          h="24px"
          minH="24px"
          px={1}
          bg="transparent"
          borderBottom="1px solid"
          borderColor="border"
          cursor="grab"
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
            {onClose && (
              <TooltipWrapper label={t('common.close')} showArrow>
                <IconButton
                  aria-label={t('common.close')}
                  size="2xs"
                  variant="ghost"
                  onClick={handleHeaderClose}
                >
                  <LuX />
                </IconButton>
              </TooltipWrapper>
            )}
          </HStack>
        </Flex>
      )}

      <Box
        flex={1}
        overflow="hidden"
        className={mode === 'bare' ? 'panel-drag-handle' : undefined}
        cursor={mode === 'bare' ? 'grab' : undefined}
      >
        {children}
      </Box>
    </Flex>
  );

  if (mode === 'bare' && onClose) {
    return (
      <Menu.Root>
        <Menu.ContextTrigger asChild>{shell}</Menu.ContextTrigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="160px" data-testid={`grid-panel-${id}-context-menu`}>
              <Menu.Item
                value="close"
                onClick={handleContextMenuClose}
                data-testid={`grid-panel-${id}-close`}
              >
                <LuX />
                {t('common.close')}
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    );
  }

  return shell;
});

GridPanel.displayName = 'GridPanel';
