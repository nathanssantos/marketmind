import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { Button, FormRow, Popover, Switch, TooltipWrapper } from '@renderer/components/ui';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChartBar, LuFlaskConical, LuScanLine, LuWrench } from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';
import { useBacktestActiveRuns } from '../../hooks/useBacktestActiveRuns';
import { useBacktestDialogStore } from '../../store/backtestDialogStore';
import { useScreenerStore } from '../../store/screenerStore';
import { useUIStore } from '../../store/uiStore';

export const ToolsPopover = memo(() => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const { isAnalyticsOpen, toggleAnalytics } = useUIStore(
    useShallow((state) => ({
      isAnalyticsOpen: state.isAnalyticsOpen,
      toggleAnalytics: state.toggleAnalytics,
    })),
  );

  const { isScreenerOpen, toggleScreener } = useScreenerStore(
    useShallow((state) => ({
      isScreenerOpen: state.isScreenerOpen,
      toggleScreener: state.toggleScreener,
    })),
  );

  const { activeRuns: activeBacktests, hasActiveRuns: hasActiveBacktest } = useBacktestActiveRuns();
  const { isBacktestOpen, toggleBacktest } = useBacktestDialogStore(
    useShallow((state) => ({
      isBacktestOpen: state.isBacktestOpen,
      toggleBacktest: state.toggleBacktest,
    })),
  );

  return (
    <Popover
      open={isOpen}
      onOpenChange={(e) => setIsOpen(e.open)}
      showArrow={false}
      width="320px"
      positioning={{ placement: 'bottom-start', offset: { mainAxis: 8 } }}
      trigger={
        <Flex>
          <TooltipWrapper
            label={t('chart.toolsMenu.configure')}
            showArrow
            placement="bottom"
            isDisabled={isOpen}
          >
            <Button
              aria-label={t('chart.toolsMenu.configure')}
              size="2xs"
              variant="outline"
              color="fg.muted"
              data-testid="toolbar-tools-button"
            >
              <LuWrench />
              {t('chart.toolsMenu.title')}
            </Button>
          </TooltipWrapper>
        </Flex>
      }
    >
      <Box p={3}>
        <Stack gap={3}>
          <Text fontSize="sm" fontWeight="semibold">
            {t('chart.toolsMenu.title')}
          </Text>
          <Stack gap={2}>
            <FormRow
              label={
                <Flex align="center" gap={2}>
                  <Box color="fg.muted"><LuScanLine /></Box>
                  <Text fontSize="xs">{t('screener.title')}</Text>
                </Flex>
              }
            >
              <Switch
                checked={isScreenerOpen}
                onCheckedChange={() => toggleScreener()}
                aria-label={t('screener.title')}
                data-testid="tools-toggle-screener"
              />
            </FormRow>
            <FormRow
              label={
                <Flex align="center" gap={2}>
                  <Box color="fg.muted" position="relative">
                    <LuFlaskConical />
                    {hasActiveBacktest && (
                      <Box
                        position="absolute"
                        top="-2px"
                        right="-2px"
                        w="6px"
                        h="6px"
                        borderRadius="full"
                        bg="trading.profit"
                        borderWidth="1px"
                        borderColor="bg.panel"
                        pointerEvents="none"
                        data-testid="tools-backtest-running-indicator"
                      />
                    )}
                  </Box>
                  <Text fontSize="xs">
                    {hasActiveBacktest
                      ? t('backtest.runningTooltip', { count: activeBacktests.length })
                      : t('backtest.title')}
                  </Text>
                </Flex>
              }
            >
              <Switch
                checked={isBacktestOpen}
                onCheckedChange={() => toggleBacktest()}
                aria-label={t('backtest.title')}
                data-testid="tools-toggle-backtest"
              />
            </FormRow>
            <FormRow
              label={
                <Flex align="center" gap={2}>
                  <Box color="fg.muted"><LuChartBar /></Box>
                  <Text fontSize="xs">{t('trading.tabs.analytics')}</Text>
                </Flex>
              }
            >
              <Switch
                checked={isAnalyticsOpen}
                onCheckedChange={() => toggleAnalytics()}
                aria-label={t('trading.tabs.analytics')}
                data-testid="tools-toggle-analytics"
              />
            </FormRow>
          </Stack>
        </Stack>
      </Box>
    </Popover>
  );
});

ToolsPopover.displayName = 'ToolsPopover';
