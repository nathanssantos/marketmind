import { Box, Flex, Text, HStack } from '@chakra-ui/react';
import { Badge, IconButton } from '@renderer/components/ui';
import { useLayoutStore } from '@renderer/store/layoutStore';
import type { GridPanelConfig } from '@shared/types/layout';
import type { MarketType } from '@marketmind/types';
import { memo, useCallback } from 'react';
import { LuMaximize2, LuMinimize2, LuMinus, LuX } from 'react-icons/lu';

interface ChartGridPanelProps {
  panelConfig: GridPanelConfig;
  symbol: string;
  marketType: MarketType;
  layoutId: string;
}

function ChartGridPanelComponent({ panelConfig, symbol, marketType: _marketType, layoutId }: ChartGridPanelProps) {
  const focusedPanelId = useLayoutStore(s => s.focusedPanelId);
  const setFocusedPanel = useLayoutStore(s => s.setFocusedPanel);
  const setPanelWindowState = useLayoutStore(s => s.setPanelWindowState);
  const removePanel = useLayoutStore(s => s.removePanel);

  const isFocused = focusedPanelId === panelConfig.id;
  const isMaximized = panelConfig.windowState === 'maximized';

  const handleFocus = useCallback(() => {
    setFocusedPanel(panelConfig.id);
  }, [setFocusedPanel, panelConfig.id]);

  const handleMinimize = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setPanelWindowState(layoutId, panelConfig.id, 'minimized');
    },
    [setPanelWindowState, layoutId, panelConfig.id],
  );

  const handleToggleMaximize = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setPanelWindowState(layoutId, panelConfig.id, isMaximized ? 'normal' : 'maximized');
    },
    [setPanelWindowState, layoutId, panelConfig.id, isMaximized],
  );

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      removePanel(layoutId, panelConfig.id);
    },
    [removePanel, layoutId, panelConfig.id],
  );

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
        <HStack gap={1}>
          <Badge size="sm" variant="subtle">{panelConfig.timeframe}</Badge>
          <Badge size="sm" variant="outline">{panelConfig.chartType}</Badge>
        </HStack>
        <HStack gap={0}>
          <IconButton
            aria-label="Minimize panel"
            size="2xs"
            variant="ghost"
            onClick={handleMinimize}
          >
            <LuMinus />
          </IconButton>
          <IconButton
            aria-label={isMaximized ? 'Restore panel' : 'Maximize panel'}
            size="2xs"
            variant="ghost"
            onClick={handleToggleMaximize}
          >
            {isMaximized ? <LuMinimize2 /> : <LuMaximize2 />}
          </IconButton>
          <IconButton
            aria-label="Close panel"
            size="2xs"
            variant="ghost"
            onClick={handleClose}
          >
            <LuX />
          </IconButton>
        </HStack>
      </Flex>
      <Box flex={1} bg="bg" overflow="hidden">
        <Flex align="center" justify="center" h="100%" color="fg.muted">
          <Text fontSize="sm">{symbol} {panelConfig.timeframe}</Text>
        </Flex>
      </Box>
    </Flex>
  );
}

export const ChartGridPanel = memo(ChartGridPanelComponent);
