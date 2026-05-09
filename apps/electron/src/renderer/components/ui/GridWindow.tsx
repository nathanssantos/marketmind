import { Box, Flex, HStack } from '@chakra-ui/react';
import { IconButton } from '@marketmind/ui';
import { GridEditOverlay } from './GridEditOverlay';
import { TooltipWrapper } from './Tooltip';
import { memo, useCallback, type ReactNode } from 'react';
import { LuMaximize2, LuMinimize2, LuMinus } from 'react-icons/lu';

export type GridWindowState = 'normal' | 'minimized' | 'maximized';

interface GridWindowProps {
  id: string;
  windowState: GridWindowState;
  /** Charts keep the focused-panel accent border so the user can see which chart drives timeframe / chart-type / indicator actions. */
  isFocused: boolean;
  /** Hide the focus border in single-panel layouts (no other chart to choose between). */
  showFocusBorder?: boolean;
  header: ReactNode;
  children: ReactNode;
  onFocus: (id: string) => void;
  onMinimize: (id: string) => void;
  onMaximize: (id: string) => void;
  onRestore: (id: string) => void;
  onClose?: (id: string) => void;
  /**
   * v1.5 — when true, the panel body is overlaid with a translucent
   * scrim + a corner X close button. The header still shows min/max
   * (non-destructive), but the in-header close goes away — close is
   * the overlay's responsibility now. Drag is also gated by the
   * parent grid's `gridEditMode` flag.
   */
  editMode?: boolean;
}

function GridWindowComponent({
  id,
  windowState,
  isFocused,
  showFocusBorder = true,
  header,
  children,
  onFocus,
  onMinimize,
  onMaximize,
  onRestore,
  onClose,
  editMode = false,
}: GridWindowProps) {
  const isMaximized = windowState === 'maximized';

  const handleFocus = useCallback(() => onFocus(id), [onFocus, id]);

  const handleMinimize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onMinimize(id);
  }, [onMinimize, id]);

  const handleToggleMaximize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMaximized) onRestore(id);
    else onMaximize(id);
  }, [onMaximize, onRestore, id, isMaximized]);

  const handleOverlayClose = useCallback((closeId: string) => onClose?.(closeId), [onClose]);

  return (
    <Flex
      direction="column"
      h="100%"
      position="relative"
      borderWidth="1px"
      borderColor={isFocused && showFocusBorder && !editMode ? 'accent.solid' : 'border'}
      borderRadius="sm"
      overflow="hidden"
      onMouseDown={handleFocus}
    >
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
          {header}
        </Box>
        <HStack gap={0} flexShrink={0}>
          <TooltipWrapper label="Minimize" showArrow>
            <IconButton aria-label="Minimize" size="2xs" variant="ghost" onClick={handleMinimize}>
              <LuMinus />
            </IconButton>
          </TooltipWrapper>
          <TooltipWrapper label={isMaximized ? 'Restore' : 'Maximize'} showArrow>
            <IconButton aria-label={isMaximized ? 'Restore' : 'Maximize'} size="2xs" variant="ghost" onClick={handleToggleMaximize}>
              {isMaximized ? <LuMinimize2 /> : <LuMaximize2 />}
            </IconButton>
          </TooltipWrapper>
        </HStack>
      </Flex>
      <Box flex={1} overflow="hidden">
        {children}
      </Box>
      {editMode && onClose && (
        <GridEditOverlay panelId={id} onClose={handleOverlayClose} />
      )}
    </Flex>
  );
}

export const GridWindow = memo(GridWindowComponent);
