import { Box, Flex, Spinner } from '@chakra-ui/react';
import { Suspense, lazy, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '../../store/uiStore';
import { MM } from '@marketmind/tokens';
import { IconButton, SidebarContainer, SidebarHeader } from '../ui';

// V1_3 bundle follow-up — MarketIndicatorsTab pulls recharts (~296 KB raw /
// 83 KB gz). Lazy-load so the chunk only ships when the user first opens the
// Market sidebar (closed by default).
const MarketIndicatorsTab = lazy(() =>
  import('./tabs/MarketIndicatorsTab').then((m) => ({ default: m.MarketIndicatorsTab })),
);

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
        <SidebarHeader
          title={t('marketSidebar.title')}
          actions={
            <IconButton
              size="2xs"
              variant="ghost"
              color="fg.muted"
              aria-label={t('marketSidebar.close')}
              onClick={() => useUIStore.getState().toggleMarketSidebar()}
            >
              <LuX />
            </IconButton>
          }
        />
        <Box flex={1} overflowY="auto">
          <Suspense
            fallback={
              <Flex justify="center" align="center" py={MM.spinner.panel.py}>
                <Spinner size={MM.spinner.panel.size} />
              </Flex>
            }
          >
            <MarketIndicatorsTab />
          </Suspense>
        </Box>
      </Flex>
    </SidebarContainer>
  );
};

export const MarketSidebar = memo(MarketSidebarComponent);
