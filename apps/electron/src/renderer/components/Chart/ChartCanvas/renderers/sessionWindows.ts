import type { MarketEvent } from '@marketmind/types';
import { INDICATOR_COLORS } from '@shared/constants';
import { getSessionById } from '@shared/constants/marketSessions';

export interface SessionWindow {
  sessionId: string;
  openTimestamp: number;
  closeTimestamp: number;
  color: string;
}

export const buildSessionWindows = (events: MarketEvent[]): SessionWindow[] => {
  const opensBySession = new Map<string, MarketEvent[]>();
  const windows: SessionWindow[] = [];

  for (const event of events) {
    const sessionId = event.metadata?.['sessionId'] as string | undefined;
    if (!sessionId || event.type !== 'market_open') continue;
    const list = opensBySession.get(sessionId) ?? [];
    list.push(event);
    opensBySession.set(sessionId, list);
  }

  for (const event of events) {
    const sessionId = event.metadata?.['sessionId'] as string | undefined;
    if (!sessionId || event.type !== 'market_close') continue;

    const session = getSessionById(sessionId);
    if (!session) continue;

    const opens = opensBySession.get(sessionId);
    if (!opens) continue;

    let bestOpen: MarketEvent | undefined;
    for (const o of opens) {
      if (o.timestamp < event.timestamp && (!bestOpen || o.timestamp > bestOpen.timestamp)) bestOpen = o;
    }

    if (bestOpen) {
      windows.push({
        sessionId,
        openTimestamp: bestOpen.timestamp,
        closeTimestamp: event.timestamp,
        color: session.color ?? INDICATOR_COLORS.SESSION_BOUNDARY_DEFAULT,
      });
    }
  }

  return windows;
};
