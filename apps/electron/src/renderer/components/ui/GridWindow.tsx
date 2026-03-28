import { Box, Flex, HStack } from '@chakra-ui/react';
import { IconButton } from './icon-button';
import { memo, useCallback, type ReactNode } from 'react';
import { LuMaximize2, LuMinimize2, LuMinus, LuX } from 'react-icons/lu';

export type GridWindowState = 'normal' | 'minimized' | 'maximized';

interface GridWindowProps {
  id: string;
  windowState: GridWindowState;
  isFocused: boolean;
  header: ReactNode;
  children: ReactNode;
  onFocus: (id: string) => void;
  onMinimize: (id: string) => void;
  onMaximize: (id: string) => void;
  onRestore: (id: string) => void;
  onClose?: (id: string) => void;
}

function GridWindowComponent({
  id,
  windowState,
  isFocused,
  header,
  children,
  onFocus,
  onMinimize,
  onMaximize,
  onRestore,
  onClose,
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
      borderColor={isFocused ? 'blue.500' : 'border'}
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
        bg="bg.subtle"
        cursor="grab"
        userSelect="none"
      >
        <Box flex={1} overflow="hidden">
          {header}
        </Box>
        <HStack gap={0} flexShrink={0}>
          <IconButton aria-label="Minimize" size="2xs" variant="ghost" onClick={handleMinimize}>
            <LuMinus />
          </IconButton>
          <IconButton aria-label={isMaximized ? 'Restore' : 'Maximize'} size="2xs" variant="ghost" onClick={handleToggleMaximize}>
            {isMaximized ? <LuMinimize2 /> : <LuMaximize2 />}
          </IconButton>
          {onClose && (
            <IconButton aria-label="Close" size="2xs" variant="ghost" onClick={handleClose}>
              <LuX />
            </IconButton>
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
