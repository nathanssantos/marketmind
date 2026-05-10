import { Box, Flex } from '@chakra-ui/react';
import { Button, Popover, PopoverActionItem, PopoverList, TooltipWrapper } from '@renderer/components/ui';
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

  const backtestLabel = hasActiveBacktest
    ? t('backtest.runningTooltip', { count: activeBacktests.length })
    : t('backtest.title');

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
              fontWeight="medium"
              gap={1.5}
              data-testid="toolbar-tools-button"
            >
              <LuWrench />
              {t('chart.toolsMenu.title')}
            </Button>
          </TooltipWrapper>
        </Flex>
      }
    >
      <PopoverList p={2}>
        <PopoverActionItem
          icon={<LuScanLine />}
          label={t('screener.title')}
          onClick={handle(toggleScreener)}
          data-testid="tools-open-screener"
        />
        <PopoverActionItem
          icon={<LuFlaskConical />}
          label={backtestLabel}
          onClick={handle(toggleBacktest)}
          trailing={
            hasActiveBacktest ? (
              <Box
                w="6px"
                h="6px"
                borderRadius="full"
                bg="trading.profit"
                data-testid="tools-backtest-running-indicator"
              />
            ) : undefined
          }
          data-testid="tools-open-backtest"
        />
        <PopoverActionItem
          icon={<LuChartBar />}
          label={t('trading.tabs.analytics')}
          onClick={handle(toggleAnalytics)}
          data-testid="tools-open-analytics"
        />
      </PopoverList>
    </Popover>
  );
});

ToolsPopover.displayName = 'ToolsPopover';
