import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { IconButton } from '@renderer/components/ui';
import { BrlValue } from '@renderer/components/BrlValue';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';

interface PortfolioSummaryProps {
  expanded: boolean;
  onToggle: () => void;
  positionsCount: number;
  profitableCount: number;
  losingCount: number;
  totalPnL: number;
  totalPnLPercent: number;
  totalExposure: number;
  totalMargin: number;
  hasLeverage: boolean;
  walletBalance: number;
  currency: string;
  effectiveCapital: number;
  stopProtectedPnl: { total: number; positionsWithStops: number };
  tpProjectedProfit: { total: number; positionsWithTp: number };
}

const PortfolioSummaryComponent = ({
  expanded,
  onToggle,
  positionsCount,
  profitableCount,
  losingCount,
  totalPnL,
  totalPnLPercent,
  totalExposure,
  totalMargin,
  hasLeverage,
  walletBalance,
  currency,
  effectiveCapital,
  stopProtectedPnl,
  tpProjectedProfit,
}: PortfolioSummaryProps) => {
  const { t } = useTranslation();

  return (
    <Box p={3} bg="bg.muted" borderRadius="md">
      <Stack gap={2.5} fontSize="xs">
        {expanded && (
          <>
            <Flex justify="space-between" align="center">
              <Text color="fg.muted">{t('trading.portfolio.activePositions')}</Text>
              <Flex gap={3} align="center">
                <Text fontWeight="medium">{positionsCount}</Text>
                <Text color="trading.profit">{profitableCount}W</Text>
                <Text color="trading.loss">{losingCount}L</Text>
              </Flex>
            </Flex>

            <Box h="1px" w="100%" bg="fg.muted" opacity={0.2} />

            <Stack gap={1}>
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.portfolio.totalExposure')}</Text>
                <Stack gap={0} align="flex-end">
                  <Text fontWeight="medium">
                    {currency} {totalExposure.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({((totalExposure / walletBalance) * 100).toFixed(1)}%)
                  </Text>
                  <BrlValue usdtValue={totalExposure} />
                </Stack>
              </Flex>
              {hasLeverage && (
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('trading.portfolio.margin')}</Text>
                  <Stack gap={0} align="flex-end">
                    <Text color="fg.muted">
                      {currency} {totalMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({((totalMargin / walletBalance) * 100).toFixed(1)}%)
                    </Text>
                    <BrlValue usdtValue={totalMargin} />
                  </Stack>
                </Flex>
              )}
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.portfolio.unrealizedPnL')}</Text>
                <Stack gap={0} align="flex-end">
                  <Text fontWeight="medium" color={totalPnL >= 0 ? 'trading.profit' : 'trading.loss'}>
                    {totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalPnL >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
                  </Text>
                  <BrlValue usdtValue={totalPnL} />
                </Stack>
              </Flex>
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.portfolio.pnlVsBalance')}</Text>
                <Text fontWeight="medium" color={totalPnL >= 0 ? 'trading.profit' : 'trading.loss'}>
                  {totalPnL >= 0 ? '+' : ''}{effectiveCapital > 0 ? ((totalPnL / effectiveCapital) * 100).toFixed(2) : '0.00'}%
                </Text>
              </Flex>
            </Stack>

            {(stopProtectedPnl.positionsWithStops > 0 || tpProjectedProfit.positionsWithTp > 0) && (
              <>
                <Box h="1px" w="100%" bg="fg.muted" opacity={0.2} />

                <Stack gap={1}>
                  {stopProtectedPnl.positionsWithStops > 0 && (
                    <Flex justify="space-between">
                      <Text color="fg.muted" flexShrink={0}>
                        {t('trading.portfolio.stopProtected')} ({stopProtectedPnl.positionsWithStops}/{positionsCount})
                      </Text>
                      <Stack gap={0} align="flex-end">
                        <Text fontWeight="medium" color={stopProtectedPnl.total >= 0 ? 'trading.profit' : 'trading.loss'} textAlign="right">
                          {stopProtectedPnl.total >= 0 ? '+' : ''}{currency} {stopProtectedPnl.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                        <Text color={stopProtectedPnl.total >= 0 ? 'trading.profit' : 'trading.loss'} textAlign="right">
                          {totalMargin > 0 ? `${stopProtectedPnl.total >= 0 ? '+' : ''}${((stopProtectedPnl.total / totalMargin) * 100).toFixed(1)}` : '0.0'}% {t('trading.portfolio.stopProtectedOfMargin')}
                        </Text>
                        <Text color={stopProtectedPnl.total >= 0 ? 'trading.profit' : 'trading.loss'} textAlign="right">
                          {walletBalance > 0 ? `${stopProtectedPnl.total >= 0 ? '+' : ''}${((stopProtectedPnl.total / walletBalance) * 100).toFixed(1)}` : '0.0'}% {t('trading.portfolio.stopProtectedOfBalance')}
                        </Text>
                        <BrlValue usdtValue={stopProtectedPnl.total} />
                      </Stack>
                    </Flex>
                  )}
                  {tpProjectedProfit.positionsWithTp > 0 && (
                    <Flex justify="space-between">
                      <Text color="fg.muted" flexShrink={0}>
                        {t('trading.portfolio.tpProjected')} ({tpProjectedProfit.positionsWithTp}/{positionsCount})
                      </Text>
                      <Stack gap={0} align="flex-end">
                        <Text fontWeight="medium" color="trading.profit" textAlign="right">
                          +{currency} {tpProjectedProfit.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                        <Text color="trading.profit" textAlign="right">
                          {totalMargin > 0 ? ((tpProjectedProfit.total / totalMargin) * 100).toFixed(1) : '0.0'}% {t('trading.portfolio.tpProjectedOfMargin')}
                        </Text>
                        <Text color="trading.profit" textAlign="right">
                          {walletBalance > 0 ? ((tpProjectedProfit.total / walletBalance) * 100).toFixed(1) : '0.0'}% {t('trading.portfolio.tpProjectedOfBalance')}
                        </Text>
                        <BrlValue usdtValue={tpProjectedProfit.total} />
                      </Stack>
                    </Flex>
                  )}
                </Stack>
              </>
            )}
          </>
        )}

        {!expanded && (
          <Stack gap={1}>
            <Flex justify="space-between" align="center">
              <Text color="fg.muted">{t('trading.portfolio.unrealizedPnL')}</Text>
              <Text fontWeight="medium" color={totalPnL >= 0 ? 'trading.profit' : 'trading.loss'}>
                {totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalPnL >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
              </Text>
            </Flex>
            <Flex justify="space-between" align="center">
              <Text color="fg.muted">{t('trading.portfolio.totalExposure')}</Text>
              <Text fontWeight="medium">
                {currency} {totalExposure.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({((totalExposure / walletBalance) * 100).toFixed(1)}%)
              </Text>
            </Flex>
          </Stack>
        )}

        <Flex justify="center">
          <IconButton
            aria-label={expanded ? 'Collapse' : 'Expand'}
            size="2xs"
            variant="ghost"
            colorPalette="gray"
            h="14px"
            w="100%"
            onClick={onToggle}
          >
            {expanded ? <LuChevronUp /> : <LuChevronDown />}
          </IconButton>
        </Flex>
      </Stack>
    </Box>
  );
};

export const PortfolioSummary = memo(PortfolioSummaryComponent);
