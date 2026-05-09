import { Box, Flex, HStack } from '@chakra-ui/react';
import { IconButton } from '@marketmind/ui';
import { TooltipWrapper } from './Tooltip';
import { memo, useCallback, type ReactNode } from 'react';
import { LuMaximize2, LuMinimize2, LuMinus, LuX } from 'react-icons/lu';

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
   * v1.5 — when false, suppresses the close button. The header still
   * shows min/max so the user can still re-arrange the workspace.
   * Drag is also gated by the parent grid's `gridEditMode` flag.
   */
  showClose?: boolean;
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
  showClose = true,
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

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClose?.(id);
  }, [onClose, id]);

  return (
    <Flex
      direction="column"
      h="100%"
      borderWidth="1px"
      borderColor={isFocused && showFocusBorder ? 'accent.solid' : 'border'}
      borderRadius="sm"
      overflow="hidden"
      onMouseDown={handleFocus}
    >
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
          {onClose && showClose && (
            <TooltipWrapper label="Close" showArrow>
              <IconButton aria-label="Close" size="2xs" variant="ghost" onClick={handleClose}>
                <LuX />
              </IconButton>
            </TooltipWrapper>
          )}
        </HStack>
      </Flex>
      <Box flex={1} overflow="hidden">
        {children}
      </Box>
    </Flex>
  );
}

export const GridWindow = memo(GridWindowComponent);
