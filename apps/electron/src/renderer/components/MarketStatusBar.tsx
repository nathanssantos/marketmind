import { Flex, Text } from '@chakra-ui/react';
import { Badge, TooltipWrapper } from '@renderer/components/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuClock, LuMoon, LuSun } from 'react-icons/lu';

type MarketSession = 'PRE_MARKET' | 'REGULAR' | 'AFTER_HOURS' | 'CLOSED';

interface MarketStatus {
  isOpen: boolean;
  session: MarketSession;
  nextEvent: { type: 'open' | 'close'; time: Date } | null;
  currentTime: Date;
}

const NYSE_TIMEZONE = 'America/New_York';

const NYSE_HOURS = {
  PRE_MARKET: { start: 4, end: 9.5 },
  REGULAR: { start: 9.5, end: 16 },
  AFTER_HOURS: { start: 16, end: 20 },
};

const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const getESTHour = (date: Date): number => {
  const estTime = new Date(date.toLocaleString('en-US', { timeZone: NYSE_TIMEZONE }));
  return estTime.getHours() + estTime.getMinutes() / 60;
};

const getMarketSession = (date: Date): MarketSession => {
  if (isWeekend(date)) return 'CLOSED';

  const hour = getESTHour(date);

  if (hour >= NYSE_HOURS.PRE_MARKET.start && hour < NYSE_HOURS.PRE_MARKET.end) {
    return 'PRE_MARKET';
  }
  if (hour >= NYSE_HOURS.REGULAR.start && hour < NYSE_HOURS.REGULAR.end) {
    return 'REGULAR';
  }
  if (hour >= NYSE_HOURS.AFTER_HOURS.start && hour < NYSE_HOURS.AFTER_HOURS.end) {
    return 'AFTER_HOURS';
  }
  return 'CLOSED';
};

const getNextMarketEvent = (date: Date): { type: 'open' | 'close'; time: Date } | null => {
  const session = getMarketSession(date);
  const estTime = new Date(date.toLocaleString('en-US', { timeZone: NYSE_TIMEZONE }));
  const hour = estTime.getHours();

  const today = new Date(estTime);
  today.setHours(0, 0, 0, 0);

  if (isWeekend(date)) {
    const daysUntilMonday = date.getDay() === 0 ? 1 : 2;
    const nextMonday = new Date(today);
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    nextMonday.setHours(9, 30, 0, 0);
    return { type: 'open', time: nextMonday };
  }

  switch (session) {
    case 'CLOSED': {
      if (hour < NYSE_HOURS.PRE_MARKET.start) {
        const preMarketOpen = new Date(today);
        preMarketOpen.setHours(4, 0, 0, 0);
        return { type: 'open', time: preMarketOpen };
      }
      const nextDayOpen = new Date(today);
      nextDayOpen.setDate(nextDayOpen.getDate() + 1);
      nextDayOpen.setHours(4, 0, 0, 0);
      return { type: 'open', time: nextDayOpen };
    }

    case 'PRE_MARKET': {
      const regularOpen = new Date(today);
      regularOpen.setHours(9, 30, 0, 0);
      return { type: 'open', time: regularOpen };
    }

    case 'REGULAR': {
      const regularClose = new Date(today);
      regularClose.setHours(16, 0, 0, 0);
      return { type: 'close', time: regularClose };
    }

    case 'AFTER_HOURS': {
      const afterHoursClose = new Date(today);
      afterHoursClose.setHours(20, 0, 0, 0);
      return { type: 'close', time: afterHoursClose };
    }

    default:
      return null;
  }
};

const useMarketStatus = (): MarketStatus => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return useMemo(() => {
    const session = getMarketSession(currentTime);
    const isOpen = session !== 'CLOSED';
    const nextEvent = getNextMarketEvent(currentTime);

    return { isOpen, session, nextEvent, currentTime };
  }, [currentTime]);
};

const formatTimeUntil = (date: Date, now: Date): string => {
  const diff = date.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

interface MarketStatusBarProps {
  show?: boolean;
}

export function MarketStatusBar({ show = true }: MarketStatusBarProps) {
  const { t } = useTranslation();
  const { isOpen, session, nextEvent, currentTime } = useMarketStatus();

  if (!show) return null;

  const getSessionBadge = () => {
    switch (session) {
      case 'PRE_MARKET':
        return (
          <Badge size="xs" colorPalette="purple" variant="subtle">
            <LuMoon size={10} />
            {t('marketStatus.preMarket')}
          </Badge>
        );
      case 'REGULAR':
        return (
          <Badge size="xs" colorPalette="green" variant="subtle">
            <LuSun size={10} />
            {t('marketStatus.open')}
          </Badge>
        );
      case 'AFTER_HOURS':
        return (
          <Badge size="xs" colorPalette="orange" variant="subtle">
            <LuMoon size={10} />
            {t('marketStatus.afterHours')}
          </Badge>
        );
      case 'CLOSED':
      default:
        return (
          <Badge size="xs" colorPalette="red" variant="subtle">
            {t('marketStatus.closed')}
          </Badge>
        );
    }
  };

  const getNextEventText = () => {
    if (!nextEvent) return null;

    const timeUntil = formatTimeUntil(nextEvent.time, currentTime);
    const eventType = nextEvent.type === 'open' ? t('marketStatus.opens') : t('marketStatus.closes');

    return `${eventType} ${t('common.in')} ${timeUntil}`;
  };

  return (
    <TooltipWrapper
      label={t('marketStatus.tooltip', { session: t(`marketStatus.${session.toLowerCase()}`) })}
      showArrow
    >
      <Flex
        align="center"
        gap={2}
        px={2}
        py={1}
        borderRadius="md"
        bg={isOpen ? 'green.subtle' : 'red.subtle'}
        cursor="default"
      >
        <LuClock size={12} />
        {getSessionBadge()}
        {nextEvent && (
          <Text fontSize="2xs" color="fg.muted">
            {getNextEventText()}
          </Text>
        )}
      </Flex>
    </TooltipWrapper>
  );
}
