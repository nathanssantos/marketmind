import { Box, Flex, Grid, GridItem, Spinner, Stack, Text } from '@chakra-ui/react';
import { DEFAULT_CURRENCY } from '@marketmind/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QUERY_CONFIG } from '@shared/constants';
import { convertUsdtToBrl, useCurrencyStore } from '../../store/currencyStore';
import { formatBRL, formatWalletCurrencyWithSign } from '../../utils/currencyFormatter';
import { trpc } from '../../utils/trpc';
import { Button } from '../ui/button';

interface PerformanceCalendarProps {
  walletId: string;
  currency?: string;
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export const PerformanceCalendar = ({ walletId, currency = DEFAULT_CURRENCY }: PerformanceCalendarProps) => {
  const { t } = useTranslation();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const usdtBrlRate = useCurrencyStore((s) => s.usdtBrlRate);
  const showBrlValues = useCurrencyStore((s) => s.showBrlValues);

  const { data = [], isLoading } = trpc.analytics.getDailyPerformance.useQuery(
    { walletId, year, month },
    { enabled: !!walletId, staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM }
  );

  const dailyMap = new Map(data.map((d) => [d.date, d]));

  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const goToPrev = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goToNext = () => {
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    if (year === currentYear && month === currentMonth) return;
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const isNextDisabled = year === now.getFullYear() && month === now.getMonth() + 1;

  const cells: (number | null)[] = [
    ...Array<null>(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const formatDateKey = (day: number) => {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  const getSignColor = (value: number) => {
    if (value > 0) return 'green.500';
    if (value < 0) return 'red.500';
    return 'fg.muted';
  };

  const getDayBg = (value: number) => {
    if (value > 0) return 'green.subtle';
    if (value < 0) return 'red.subtle';
    return 'bg.muted';
  };

  const monthLabel = `${t(`trading.analytics.calendar.months.${month}`)} ${year}`;

  return (
    <Stack gap={3}>
      <Flex justify="space-between" align="center" pb={2} borderBottomWidth="1px">
        <Text fontSize="lg" fontWeight="bold">
          {t('trading.analytics.calendar.title')}
        </Text>
        <Flex align="center" gap={2}>
          <Button size="xs" variant="outline" onClick={goToPrev} px={2}>
            ‹
          </Button>
          <Text fontSize="sm" fontWeight="medium" minW="120px" textAlign="center">
            {monthLabel}
          </Text>
          <Button size="xs" variant="outline" onClick={goToNext} px={2} disabled={isNextDisabled}>
            ›
          </Button>
        </Flex>
      </Flex>

      {isLoading ? (
        <Flex justify="center" align="center" py={6}>
          <Spinner size="md" />
        </Flex>
      ) : (
        <Box>
          <Grid templateColumns="repeat(7, 1fr)" gap={1} mb={1}>
            {WEEKDAY_KEYS.map((key) => (
              <GridItem key={key}>
                <Text fontSize="xs" color="fg.muted" textAlign="center" fontWeight="medium">
                  {t(`trading.analytics.calendar.weekdays.${key}`)}
                </Text>
              </GridItem>
            ))}
          </Grid>

          <Grid templateColumns="repeat(7, 1fr)" gap={1}>
            {cells.map((day, idx) => {
              if (day === null) return <GridItem key={`empty-${idx}`} />;

              const dateKey = formatDateKey(day);
              const entry = dailyMap.get(dateKey);

              if (!entry) {
                return (
                  <GridItem key={dateKey}>
                    <Box
                      bg="bg.muted"
                      borderRadius="sm"
                      p={1}
                      minH="52px"
                      opacity={0.5}
                    >
                      <Text fontSize="10px" color="fg.muted" lineHeight="1">
                        {day}
                      </Text>
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
                    minH="52px"
                    title={t('trading.analytics.calendar.trades', { count: entry.tradesCount })}
                  >
                    <Text fontSize="10px" color="fg.muted" lineHeight="1" mb="2px">
                      {day}
                    </Text>
                    <Text fontSize="10px" fontWeight="bold" color={pnlColor} lineHeight="1.2">
                      {pnlFormatted}
                    </Text>
                    <Text fontSize="9px" color={pnlColor} lineHeight="1.2">
                      {percentFormatted}
                    </Text>
                    {brlFormatted && (
                      <Text fontSize="9px" color="fg.muted" lineHeight="1.2">
                        {entry.pnl < 0 ? '-' : ''}{brlFormatted}
                      </Text>
                    )}
                  </Box>
                </GridItem>
              );
            })}
          </Grid>

          {data.length === 0 && (
            <Text fontSize="sm" color="fg.muted" textAlign="center" py={4}>
              {t('trading.analytics.calendar.noData')}
            </Text>
          )}
        </Box>
      )}
    </Stack>
  );
};
