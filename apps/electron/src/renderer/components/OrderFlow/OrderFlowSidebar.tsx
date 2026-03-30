import { Box, Flex, Text } from '@chakra-ui/react';
import { useDepth } from '@renderer/hooks/useDepth';
import { useFastPriceForSymbol } from '@renderer/store/priceStore';
import { type OrderFlowSidebarTab, useUIStore } from '@renderer/store/uiStore';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';
import { DomLadder } from '../Chart/DomLadder';
import { IconButton, SidebarContainer, Tabs } from '../ui';
import { OrderFlowMetrics } from './OrderFlowMetrics';

interface OrderFlowSidebarProps {
  width: number;
  symbol: string;
}

const OrderFlowSidebarComponent = ({ width, symbol }: OrderFlowSidebarProps) => {
  const { t } = useTranslation();

  const { orderFlowSidebarTab, setOrderFlowSidebarTab, orderFlowSidebarOpen } = useUIStore(
    useShallow((s) => ({
      orderFlowSidebarTab: s.orderFlowSidebarTab,
      setOrderFlowSidebarTab: s.setOrderFlowSidebarTab,
      orderFlowSidebarOpen: s.orderFlowSidebarOpen,
    }))
  );

  const handleTabChange = useCallback(
    (details: { value: string }) => {
      setOrderFlowSidebarTab(details.value as OrderFlowSidebarTab);
    },
    [setOrderFlowSidebarTab]
  );

  const { bids, asks } = useDepth(symbol, orderFlowSidebarOpen);
  const currentPrice = useFastPriceForSymbol(symbol) ?? 0;

  if (!orderFlowSidebarOpen) return null;

  return (
    <SidebarContainer width={width} position="left">
      <Tabs.Root
        value={orderFlowSidebarTab}
        onValueChange={handleTabChange}
        fitted
        h="full"
        display="flex"
        flexDirection="column"
      >
        <Flex>
          <Tabs.List flex={1}>
            <Tabs.Trigger value="dom">
              <Text fontSize="xs">{t('orderFlow.tabs.dom', 'DOM')}</Text>
            </Tabs.Trigger>
            <Tabs.Trigger value="metrics">
              <Text fontSize="xs">{t('orderFlow.tabs.metrics', 'Metrics')}</Text>
            </Tabs.Trigger>
          </Tabs.List>
          <IconButton size="2xs" variant="ghost" color="fg.muted" aria-label="Close" onClick={() => useUIStore.getState().toggleOrderFlowSidebar()} mr={1} mt={0.5}>
            <LuX />
          </IconButton>
        </Flex>

        <Box flex={1} minH={0} display="flex" flexDirection="column">
          <Tabs.Content value="dom" flex={1} minH={0} display="flex" flexDirection="column">
            <DomLadder bids={bids} asks={asks} currentPrice={currentPrice} />
          </Tabs.Content>

          <Tabs.Content value="metrics" flex={1} minH={0} overflowY="auto">
            <OrderFlowMetrics symbol={symbol} />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </SidebarContainer>
  );
};

export const OrderFlowSidebar = memo(OrderFlowSidebarComponent);
