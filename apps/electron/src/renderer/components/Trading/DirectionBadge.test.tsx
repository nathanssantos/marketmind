import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DirectionBadge } from './DirectionBadge';
import type { BtcTrendStatus } from './WatcherManager/QuickStartSection';

const renderBadge = (props: Parameters<typeof DirectionBadge>[0]) =>
  render(
    <ChakraProvider value={defaultSystem}>
      <DirectionBadge {...props} />
    </ChakraProvider>
  );

describe('DirectionBadge', () => {
  it('renders LONG ONLY label when directionMode=long_only', () => {
    renderBadge({ directionMode: 'long_only', showBtcTrend: false });
    expect(screen.getByText(/LONG ONLY/)).toBeDefined();
  });

  it('renders SHORT ONLY label when directionMode=short_only', () => {
    renderBadge({ directionMode: 'short_only', showBtcTrend: false });
    expect(screen.getByText(/SHORT ONLY/)).toBeDefined();
  });

  it('returns null when isIB=true (IB has no btc trend)', () => {
    const trend: BtcTrendStatus = { trend: 'BULLISH', canLong: true, canShort: true };
    const { container } = renderBadge({
      directionMode: 'auto',
      showBtcTrend: true,
      btcTrendStatus: trend,
      isIB: true,
    });
    expect(container.textContent).toBe('');
  });

  it('returns null when showBtcTrend=false (auto mode)', () => {
    const { container } = renderBadge({ directionMode: 'auto', showBtcTrend: false });
    expect(container.textContent).toBe('');
  });

  it('returns null when no btcTrendStatus provided', () => {
    const { container } = renderBadge({ directionMode: 'auto', showBtcTrend: true });
    expect(container.textContent).toBe('');
  });

  it('renders BTC: BULLISH badge when trend is bullish', () => {
    const trend: BtcTrendStatus = { trend: 'BULLISH', canLong: true, canShort: true };
    renderBadge({ directionMode: 'auto', showBtcTrend: true, btcTrendStatus: trend });
    expect(screen.getByText(/BTC: BULLISH/)).toBeDefined();
  });

  it('renders BTC: BEARISH badge when trend is bearish', () => {
    const trend: BtcTrendStatus = { trend: 'BEARISH', canLong: true, canShort: true };
    renderBadge({ directionMode: 'auto', showBtcTrend: true, btcTrendStatus: trend });
    expect(screen.getByText(/BTC: BEARISH/)).toBeDefined();
  });

  it('appends LONG blocked when canLong is false', () => {
    const trend: BtcTrendStatus = { trend: 'BEARISH', canLong: false, canShort: true };
    renderBadge({ directionMode: 'auto', showBtcTrend: true, btcTrendStatus: trend });
    expect(screen.getByText(/\(LONG blocked\)/)).toBeDefined();
  });

  it('appends SHORT blocked when canShort is false', () => {
    const trend: BtcTrendStatus = { trend: 'BULLISH', canLong: true, canShort: false };
    renderBadge({ directionMode: 'auto', showBtcTrend: true, btcTrendStatus: trend });
    expect(screen.getByText(/\(SHORT blocked\)/)).toBeDefined();
  });

  it('renders skipped count badge when skippedTrendCount > 0', () => {
    const trend: BtcTrendStatus = { trend: 'BULLISH', canLong: true, canShort: true };
    renderBadge({
      directionMode: 'auto',
      showBtcTrend: true,
      btcTrendStatus: trend,
      skippedTrendCount: 3,
    });
    expect(screen.getByText(/3 filtered/)).toBeDefined();
  });

  it('hides skipped count badge when skippedTrendCount=0', () => {
    const trend: BtcTrendStatus = { trend: 'BULLISH', canLong: true, canShort: true };
    renderBadge({
      directionMode: 'auto',
      showBtcTrend: true,
      btcTrendStatus: trend,
      skippedTrendCount: 0,
    });
    expect(screen.queryByText(/filtered/)).toBeNull();
  });
});
