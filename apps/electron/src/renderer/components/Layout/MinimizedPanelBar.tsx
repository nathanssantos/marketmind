import { Flex, HStack, Text } from '@chakra-ui/react';
import { IconButton, TooltipWrapper } from '@renderer/components/ui';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { isChartPanel } from '@shared/types/layout';
import { getPanelDef } from '@renderer/grid/panel-registry';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LuMaximize2 } from 'react-icons/lu';

function MinimizedPanelBarComponent() {
  const { t } = useTranslation();
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
    <Flex align="center" gap={1} h="28px" minH="28px" px={2} borderTop="1px solid" borderColor="border">
      {minimizedPanels.map(panel => (
        <HStack
          key={panel.id}
          gap={1}
          px={2}
          h="22px"
          bg="bg.subtle"
          borderRadius="sm"
          cursor="pointer"
          _hover={{ bg: 'bg.muted' }}
          onClick={() => handleRestore(panel.id)}
        >
          <Text fontSize="xs" color="fg.muted">
            {isChartPanel(panel) ? `${panel.timeframe} ${panel.chartType}` : t(getPanelDef(panel.kind).titleKey)}
          </Text>
          <TooltipWrapper label="Restore" showArrow>
            <IconButton aria-label="Restore" size="2xs" variant="ghost" onClick={(e) => { e.stopPropagation(); handleRestore(panel.id); }}>
              <LuMaximize2 />
            </IconButton>
          </TooltipWrapper>
        </HStack>
      ))}
    </Flex>
  );
}

export const MinimizedPanelBar = memo(MinimizedPanelBarComponent);
