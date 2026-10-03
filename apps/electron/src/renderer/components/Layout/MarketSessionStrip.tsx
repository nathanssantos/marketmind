import { Flex, Text } from '@chakra-ui/react';
import { Badge } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';
import { LuClock, LuMoon, LuSun } from 'react-icons/lu';

type SessionType = 'PRE_MARKET' | 'REGULAR' | 'AFTER_HOURS' | 'CLOSED';

export interface MarketSessionStatus {
  isOpen: boolean;
  sessionType: SessionType;
  nextOpen: string | null;
  nextClose: string | null;
  timezone: string;
}

const SESSION_LABEL_KEY: Record<SessionType, string> = {
  PRE_MARKET: 'marketStatus.preMarket',
  REGULAR: 'marketStatus.open',
  AFTER_HOURS: 'marketStatus.afterHours',
  CLOSED: 'marketStatus.closed',
};

const SESSION_PALETTE: Record<SessionType, string> = {
  PRE_MARKET: 'orange',
  REGULAR: 'green',
  AFTER_HOURS: 'orange',
  CLOSED: 'gray',
};

const SESSION_ICON: Record<SessionType, typeof LuSun> = {
  PRE_MARKET: LuClock,
  REGULAR: LuSun,
  AFTER_HOURS: LuClock,
  CLOSED: LuMoon,
};

const formatEventTime = (iso: string, timezone: string): string =>
  new Date(iso).toLocaleString(undefined, { timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit' });

export const MarketSessionStrip = ({ status }: { status: MarketSessionStatus }) => {
  const { t } = useTranslation();
  const Icon = SESSION_ICON[status.sessionType];
  const nextEvent = status.sessionType === 'CLOSED'
    ? status.nextOpen && `${t('marketStatus.opens')} ${formatEventTime(status.nextOpen, status.timezone)}`
    : status.nextClose && `${t('marketStatus.closes')} ${formatEventTime(status.nextClose, status.timezone)}`;

  return (
    <Flex align="center" gap={2} px={1} data-testid="trade-ticket-market-session">
      <Badge size="xs" variant="subtle" colorPalette={SESSION_PALETTE[status.sessionType]}>
        <Flex align="center" gap={1}>
          <Icon size={10} />
          <Text>{t(SESSION_LABEL_KEY[status.sessionType])}</Text>
        </Flex>
      </Badge>
      {nextEvent && <Text fontSize="2xs" color="fg.muted">{nextEvent}</Text>}
    </Flex>
  );
};
