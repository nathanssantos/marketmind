import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { Button, Popover, TooltipWrapper } from '@renderer/components/ui';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChartBar, LuFlaskConical, LuScanLine, LuWrench } from 'react-icons/lu';
import { useBacktestActiveRuns } from '../../hooks/useBacktestActiveRuns';
import { useBacktestDialogStore } from '../../store/backtestDialogStore';
import { useScreenerStore } from '../../store/screenerStore';
import { useUIStore } from '../../store/uiStore';

export const ToolsPopover = memo(() => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const toggleAnalytics = useUIStore((s) => s.toggleAnalytics);
  const toggleScreener = useScreenerStore((s) => s.toggleScreener);
  const toggleBacktest = useBacktestDialogStore((s) => s.toggleBacktest);
  const { activeRuns: activeBacktests, hasActiveRuns: hasActiveBacktest } = useBacktestActiveRuns();

  const handle = useCallback(
    (fn: () => void) => () => {
      fn();
      setIsOpen(false);
    },
    [],
  );

  return (
    <Popover
      open={isOpen}
      onOpenChange={(e) => setIsOpen(e.open)}
      showArrow={false}
      width="240px"
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
      <Box p={2}>
        <Stack gap={1}>
          <Button
            variant="ghost"
            size="xs"
            justifyContent="flex-start"
            onClick={handle(toggleScreener)}
            data-testid="tools-open-screener"
          >
            <LuScanLine />
            <Text>{t('screener.title')}</Text>
          </Button>
          <Button
            variant="ghost"
            size="xs"
            justifyContent="flex-start"
            onClick={handle(toggleBacktest)}
            data-testid="tools-open-backtest"
            position="relative"
          >
            <LuFlaskConical />
            <Text>
              {hasActiveBacktest
                ? t('backtest.runningTooltip', { count: activeBacktests.length })
                : t('backtest.title')}
            </Text>
            {hasActiveBacktest && (
              <Box
                position="absolute"
                top="6px"
                right="6px"
                w="6px"
                h="6px"
                borderRadius="full"
                bg="trading.profit"
                pointerEvents="none"
                data-testid="tools-backtest-running-indicator"
              />
            )}
          </Button>
          <Button
            variant="ghost"
            size="xs"
            justifyContent="flex-start"
            onClick={handle(toggleAnalytics)}
            data-testid="tools-open-analytics"
          >
            <LuChartBar />
            <Text>{t('trading.tabs.analytics')}</Text>
          </Button>
        </Stack>
      </Box>
    </Popover>
  );
});

ToolsPopover.displayName = 'ToolsPopover';
