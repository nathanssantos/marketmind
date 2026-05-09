import { Box, Flex, Grid, GridItem, Stack, Text } from '@chakra-ui/react';
import { LoadingSpinner } from '@renderer/components/ui';
import { DEFAULT_CURRENCY } from '@marketmind/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QUERY_CONFIG } from '@shared/constants';
import { convertUsdtToBrl, useCurrencyStore } from '../../store/currencyStore';
import { formatBRL, formatWalletCurrencyWithSign } from '../../utils/currencyFormatter';
import { trpc } from '../../utils/trpc';
import { Button, PanelHeader } from '@renderer/components/ui';
import { MM } from '@marketmind/tokens';

interface PerformanceCalendarProps {
  walletId: string;
  currency?: string;
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export const PerformanceCalendar = ({ walletId, currency = DEFAULT_CURRENCY }: PerformanceCalendarProps) => {
  const { t } = useTranslation();
  // UTC-anchored everywhere — same TZ Binance uses for daily PnL
  // bucketing. Local-time math (`getFullYear`, `getMonth`, `new Date(y,m,1)`)
  // would drift the calendar/widget by a day for non-UTC users near
  // midnight UTC, causing "today" in this calendar to disagree with the
  // sidebar "Today's P&L" widget.
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);

  const usdtBrlRate = useCurrencyStore((s) => s.usdtBrlRate);
  const showBrlValues = useCurrencyStore((s) => s.showBrlValues);

  const { data, isLoading } = trpc.analytics.getDailyPerformance.useQuery(
    { walletId, year, month, tz: 'UTC' },
    { enabled: !!walletId, staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM }
  );

  const dailyMap = new Map((data ?? []).map((d) => [d.date, d]));

  // UTC-anchored boundaries: `new Date(year, month-1, 1)` is local time
  // and would shift the calendar grid for non-UTC users. Date.UTC builds
  // the timestamp at UTC midnight; reading `getUTCDay()` gives the right
  // weekday regardless of where the browser is.
  const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const goToPrev = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goToNext = () => {
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;
    if (year === currentYear && month === currentMonth) return;
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const isNextDisabled = year === now.getUTCFullYear() && month === now.getUTCMonth() + 1;

  const allCells: (number | null)[] = [
    ...Array<null>(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < allCells.length; i += 7) {
    weeks.push(allCells.slice(i, i + 7));
  }
  const lastWeek = weeks[weeks.length - 1];
  if (lastWeek && lastWeek.length < 7) {
    while (lastWeek.length < 7) lastWeek.push(null);
  }

  const getWeekPnl = (week: (number | null)[]) => {
    let pnl = 0;
    let pnlPercent = 0;
    let wins = 0;
    let losses = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let hasTrades = false;
    for (const day of week) {
      if (day === null) continue;
      const entry = dailyMap.get(formatDateKey(day));
      if (entry) {
        pnl += entry.pnl;
        pnlPercent += entry.pnlPercent;
        wins += entry.wins;
        losses += entry.losses;
        grossProfit += entry.grossProfit;
        grossLoss += entry.grossLoss;
        hasTrades = true;
      }
    }
    const totalTrades = wins + losses;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    return { pnl, pnlPercent, wins, losses, winRate, profitFactor, hasTrades };
  };

  const monthTotal = (data ?? []).reduce(
    (acc, d) => ({
      pnl: acc.pnl + d.pnl,
      pnlPercent: acc.pnlPercent + d.pnlPercent,
      trades: acc.trades + d.tradesCount,
      wins: acc.wins + d.wins,
      losses: acc.losses + d.losses,
      grossProfit: acc.grossProfit + d.grossProfit,
      grossLoss: acc.grossLoss + d.grossLoss,
    }),
    { pnl: 0, pnlPercent: 0, trades: 0, wins: 0, losses: 0, grossProfit: 0, grossLoss: 0 }
  );

  const monthTotalTrades = monthTotal.wins + monthTotal.losses;
  const monthWinRate = monthTotalTrades > 0 ? (monthTotal.wins / monthTotalTrades) * 100 : 0;
  const monthProfitFactor = monthTotal.grossLoss > 0
    ? monthTotal.grossProfit / monthTotal.grossLoss
    : monthTotal.grossProfit > 0 ? Infinity : 0;

  const formatDateKey = (day: number) => {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  const getSignColor = (value: number) => {
    if (value > 0) return 'trading.profit';
    if (value < 0) return 'trading.loss';
    return 'fg.muted';
  };

  const getDayBg = (value: number) => {
    if (value > 0) return 'trading.profit/20';
    if (value < 0) return 'trading.loss/20';
    return 'bg.muted';
  };

  const monthLabel = `${t(`trading.analytics.calendar.months.${month}`)} ${year}`;

  return (
    <Stack gap={3}>
      <PanelHeader
        title={t('trading.analytics.calendar.title')}
        action={
          <Flex align="center" gap={1.5}>
            <Button size={MM.buttonSize.nav} variant="outline" onClick={goToPrev} px={1.5} minW="auto">
              ‹
            </Button>
            <Text fontSize="xs" fontWeight="medium" minW="100px" textAlign="center">
              {monthLabel}
            </Text>
            <Button size={MM.buttonSize.nav} variant="outline" onClick={goToNext} px={1.5} minW="auto" disabled={isNextDisabled}>
              ›
            </Button>
          </Flex>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <Box>
          <Grid templateColumns="repeat(8, 1fr)" gap={1} mb={1}>
            {WEEKDAY_KEYS.map((key) => (
              <GridItem key={key}>
                <Text fontSize="xs" color="fg.muted" textAlign="center" fontWeight="medium">
                  {t(`trading.analytics.calendar.weekdays.${key}`)}
                </Text>
              </GridItem>
            ))}
            <GridItem>
              <Text fontSize="xs" color="fg.muted" textAlign="center" fontWeight="medium">
                {t('trading.analytics.calendar.week')}
              </Text>
            </GridItem>
          </Grid>

          {weeks.map((week, weekIdx) => {
            const weekSummary = getWeekPnl(week);
            const weekPnlColor = getSignColor(weekSummary.pnl);
            const weekBg = getDayBg(weekSummary.pnl);

            return (
              <Grid key={weekIdx} templateColumns="repeat(8, 1fr)" gap={1} mb={1}>
                {week.map((day, dayIdx) => {
                  if (day === null) return <GridItem key={`empty-${weekIdx}-${dayIdx}`}><Box h="100%" /></GridItem>;

                  const dateKey = formatDateKey(day);
                  const entry = dailyMap.get(dateKey);

                  if (!entry) {
                    return (
                      <GridItem key={dateKey}>
                        <Box bg="bg.muted" borderRadius="sm" p={1} h="100%" opacity={0.5}>
                          <Text fontSize="10px" color="fg.muted" lineHeight="1">{day}</Text>
                        </Box>
                      </GridItem>
                    );
                  }

                  const pnlColor = getSignColor(entry.pnl);
                  const dayBg = getDayBg(entry.pnl);
                  const pnlFormatted = formatWalletCurrencyWithSign(entry.pnl, currency);
                  const percentFormatted = `${entry.pnlPercent >= 0 ? '+' : ''}${entry.pnlPercent.toFixed(2)}%`;
                  const brlFormatted = showBrlValues
                    ? formatBRL(convertUsdtToBrl(Math.abs(entry.pnl), usdtBrlRate))
                    : null;

                  return (
                    <GridItem key={dateKey}>
                      <Box
                        bg={dayBg}
                        borderRadius="sm"
                        p={1}
                        h="100%"
                        title={t('trading.analytics.calendar.trades', { count: entry.tradesCount })}
                      >
                        <Text fontSize="10px" color="fg.muted" lineHeight="1" mb="2px">{day}</Text>
                        <Text fontSize="10px" fontWeight="bold" color={pnlColor} lineHeight="1.2">{pnlFormatted}</Text>
                        <Text fontSize="9px" color={pnlColor} lineHeight="1.2">{percentFormatted}</Text>
                        {brlFormatted && (
                          <Text fontSize="9px" color="fg.muted" lineHeight="1.2">
                            {entry.pnl < 0 ? '-' : ''}{brlFormatted}
                          </Text>
                        )}
                      </Box>
                    </GridItem>
                  );
                })}

                <GridItem>
                  {weekSummary.hasTrades ? (
                    <Box bg={weekBg} borderRadius="sm" p={1} h="100%">
                      <Text fontSize="10px" color="fg.muted" lineHeight="1" mb="2px">W{weekIdx + 1}</Text>
                      <Text fontSize="10px" fontWeight="bold" color={weekPnlColor} lineHeight="1.2">
                        {formatWalletCurrencyWithSign(weekSummary.pnl, currency)}
                      </Text>
                      <Text fontSize="9px" color={weekPnlColor} lineHeight="1.2">
                        {weekSummary.pnlPercent >= 0 ? '+' : ''}{weekSummary.pnlPercent.toFixed(2)}%
                      </Text>
                      {showBrlValues && (
                        <Text fontSize="9px" color="fg.muted" lineHeight="1.2">
                          {weekSummary.pnl < 0 ? '-' : ''}{formatBRL(convertUsdtToBrl(Math.abs(weekSummary.pnl), usdtBrlRate))}
                        </Text>
                      )}
                      {weekSummary.wins + weekSummary.losses > 0 && (
                        <Text fontSize="9px" color="fg.muted" lineHeight="1.2">
                          WR {weekSummary.winRate.toFixed(0)}% · PF {weekSummary.profitFactor === Infinity ? '\u221E' : weekSummary.profitFactor.toFixed(1)}
                        </Text>
                      )}
                    </Box>
                  ) : (
                    <Box bg="bg.muted" borderRadius="sm" p={1} h="100%" opacity={0.5} />
                  )}
                </GridItem>
              </Grid>
            );
          })}

          {(data?.length ?? 0) > 0 && (
            <Grid templateColumns="repeat(8, 1fr)" gap={1} mt={1}>
              <GridItem colSpan={7} />
              <GridItem>
                <Box bg={getDayBg(monthTotal.pnl)} borderRadius="sm" p={1} h="100%">
                  <Text fontSize="10px" color="fg.muted" lineHeight="1" mb="2px">
                    {t(`trading.analytics.calendar.months.${month}`).slice(0, 3)}
                  </Text>
                  <Text fontSize="10px" fontWeight="bold" color={getSignColor(monthTotal.pnl)} lineHeight="1.2">
                    {formatWalletCurrencyWithSign(monthTotal.pnl, currency)}
                  </Text>
                  <Text fontSize="9px" color={getSignColor(monthTotal.pnl)} lineHeight="1.2">
                    {monthTotal.pnlPercent >= 0 ? '+' : ''}{monthTotal.pnlPercent.toFixed(2)}%
                  </Text>
                  {showBrlValues && (
                    <Text fontSize="9px" color="fg.muted" lineHeight="1.2">
                      {monthTotal.pnl < 0 ? '-' : ''}{formatBRL(convertUsdtToBrl(Math.abs(monthTotal.pnl), usdtBrlRate))}
                    </Text>
                  )}
                  {monthTotalTrades > 0 && (
                    <Text fontSize="9px" color="fg.muted" lineHeight="1.2">
                      WR {monthWinRate.toFixed(0)}% · PF {monthProfitFactor === Infinity ? '\u221E' : monthProfitFactor.toFixed(1)}
                    </Text>
                  )}
                </Box>
              </GridItem>
            </Grid>
          )}

          {(data?.length ?? 0) === 0 && (
            <Text fontSize="sm" color="fg.muted" textAlign="center" py={4}>
              {t('trading.analytics.calendar.noData')}
            </Text>
          )}
        </Box>
      )}
    </Stack>
  );
};
