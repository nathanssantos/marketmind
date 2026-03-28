import { Box, ChakraProvider, Flex, Text as ChakraText, Toaster } from '@chakra-ui/react';
import { IconButton, ToggleIconButton, TooltipWrapper } from '../components/ui';
import { useCallback, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { LuDollarSign, LuX } from 'react-icons/lu';
import { PinnedControlsProvider } from '../components/Chart/PinnedControlsContext';
import { ChartGrid } from '../components/Layout/ChartGrid';
import { ChartToolsToolbar } from '../components/Layout/ChartToolsToolbar';
import { LayoutTabBar } from '../components/Layout/LayoutTabBar';
import { MinimizedPanelBar } from '../components/Layout/MinimizedPanelBar';
import { QuickTradeToolbar } from '../components/Layout/QuickTradeToolbar';
import { SymbolTabBar } from '../components/Layout/SymbolTabBar';
import { Toolbar } from '../components/Layout/Toolbar';
import { PreferencesHydrator } from '../components/PreferencesHydrator';
import { ChartProvider } from '../context/ChartContext';
import { useLayoutSync } from '../hooks/useLayoutSync';
import { useCurrencyAutoRefresh } from '../store/currencyStore';
import { system } from '../theme';
import { toaster } from '../utils/toaster';

function ChartWindowContent(): ReactElement {
  const { t } = useTranslation();
  const [showQuickTrade, setShowQuickTrade] = useState(false);

  useCurrencyAutoRefresh();

  const {
    effectiveSymbol,
    effectiveMarketType,
    effectiveTimeframe,
    effectiveChartType,
    handleSymbolChange,
    handleTimeframeChange,
    handleChartTypeChange,
    handleMarketTypeChange,
  } = useLayoutSync();

  const toggleQuickTrade = useCallback(() => {
    setShowQuickTrade((v) => !v);
  }, []);

  return (
    <Box display="flex" flexDirection="column" h="100vh">
      <Box flexShrink={0} height="30px">
        <Toolbar
          symbol={effectiveSymbol}
          marketType={effectiveMarketType}
          onMarketTypeChange={handleMarketTypeChange}
          onSymbolChange={handleSymbolChange}
          timeframe={effectiveTimeframe}
          chartType={effectiveChartType}
          onChartTypeChange={handleChartTypeChange}
          onTimeframeChange={handleTimeframeChange}
          showNewWindowButton={false}
          showSidebarButtons={false}
          isTradingOpen={false}
          isAutoTradingOpen={false}
          onToggleTrading={() => { }}
          onToggleAutoTrading={() => { }}
          rightExtra={
            <TooltipWrapper label={t('trading.sidebar.title')} showArrow>
              <ToggleIconButton
                active={showQuickTrade}
                onClick={toggleQuickTrade}
                aria-label={t('trading.sidebar.title')}
                size="2xs"
              >
                <LuDollarSign />
              </ToggleIconButton>
            </TooltipWrapper>
          }
        />
      </Box>

      <SymbolTabBar />

      <Flex flex={1} overflow="hidden">
        <ChartToolsToolbar />

        <Flex flex={1} direction="column" overflow="hidden">
          {effectiveSymbol && showQuickTrade && (
            <QuickTradeToolbar
              symbol={effectiveSymbol}
              marketType={effectiveMarketType}
              onClose={() => setShowQuickTrade(false)}
            />
          )}
          <ChartGrid />
          <MinimizedPanelBar />
        </Flex>
      </Flex>

      <LayoutTabBar />
    </Box>
  );
}

export function ChartWindow(): ReactElement {
  const { t } = useTranslation();

  return (
    <ChakraProvider value={system}>
      <Toaster toaster={toaster}>
        {toast => {
          if (!toast.title && !toast.description) return null;

          return (
            <Box
              bg={
                toast.type === 'success'
                  ? 'green.500'
                  : toast.type === 'error'
                    ? 'red.500'
                    : toast.type === 'info'
                      ? 'blue.500'
                      : 'orange.500'
              }
              color="white"
              p={4}
              borderRadius="md"
              boxShadow="lg"
              maxW="400px"
              position="relative"
            >
              <IconButton
                aria-label={t('common.close')}
                size="xs"
                position="absolute"
                top={2}
                right={2}
                onClick={() => toaster.dismiss(toast.id)}
                variant="ghost"
                color="white"
                _hover={{ bg: 'whiteAlpha.200' }}
              >
                <LuX />
              </IconButton>
              <ChakraText fontWeight="bold" fontSize="sm" mb={1} pr={6}>
                {toast.title}
              </ChakraText>
              {toast.description && (
                <ChakraText fontSize="xs">{toast.description}</ChakraText>
              )}
            </Box>
          );
        }}
      </Toaster>
      <PreferencesHydrator>
        <ChartProvider>
          <PinnedControlsProvider>
            <ChartWindowContent />
          </PinnedControlsProvider>
        </ChartProvider>
      </PreferencesHydrator>
    </ChakraProvider>
  );
}
