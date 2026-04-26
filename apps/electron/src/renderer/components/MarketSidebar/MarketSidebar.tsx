import { Box, Flex, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '../../store/uiStore';
import { IconButton, SidebarContainer } from '../ui';
import { MarketIndicatorsTab } from './tabs/MarketIndicatorsTab';

interface MarketSidebarProps {
  width: number;
}

const MarketSidebarComponent = ({ width }: MarketSidebarProps) => {
  const { t } = useTranslation();

  const { marketSidebarOpen } = useUIStore(
    useShallow((s) => ({
      marketSidebarOpen: s.marketSidebarOpen,
    }))
  );

  if (!marketSidebarOpen) return null;

  return (
    <SidebarContainer width={width} position="left">
      <Flex direction="column" h="full">
        <Flex align="center" justify="space-between" px={3} py={2} borderBottomWidth="1px" borderColor="border">
          <Text fontSize="xs" fontWeight="semibold">{t('marketSidebar.title')}</Text>
          <IconButton
            size="2xs"
            variant="ghost"
            color="fg.muted"
            aria-label={t('marketSidebar.close')}
            onClick={() => useUIStore.getState().toggleMarketSidebar()}
          >
            <LuX />
          </IconButton>
        </Flex>
        <Box flex={1} overflowY="auto">
          <MarketIndicatorsTab />
        </Box>
      </Flex>
    </SidebarContainer>
  );
};

export const MarketSidebar = memo(MarketSidebarComponent);
