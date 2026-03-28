import { Flex } from '@chakra-ui/react';
import { Badge } from '@renderer/components/ui';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { memo, useCallback } from 'react';

function MinimizedPanelBarComponent() {
  const activeLayout = useLayoutStore(s => s.getActiveLayout());
  const setPanelWindowState = useLayoutStore(s => s.setPanelWindowState);

  const minimizedPanels = activeLayout?.grid.filter(p => p.windowState === 'minimized') ?? [];

  const handleRestore = useCallback(
    (panelId: string) => {
      if (!activeLayout) return;
      setPanelWindowState(activeLayout.id, panelId, 'normal');
    },
    [activeLayout, setPanelWindowState],
  );

  if (minimizedPanels.length === 0) return null;

  return (
    <Flex align="center" gap={1} h="24px" minH="24px" px={2} bg="bg.subtle">
      {minimizedPanels.map(panel => (
        <Badge
          key={panel.id}
          size="sm"
          variant="subtle"
          cursor="pointer"
          onClick={() => handleRestore(panel.id)}
          _hover={{ opacity: 0.8 }}
        >
          {panel.timeframe}
        </Badge>
      ))}
    </Flex>
  );
}

export const MinimizedPanelBar = memo(MinimizedPanelBarComponent);
