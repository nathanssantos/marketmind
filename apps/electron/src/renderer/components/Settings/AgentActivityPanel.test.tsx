import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let auditRows: Array<{
  id: number;
  walletId: string | null;
  tool: string;
  status: 'success' | 'failure' | 'denied' | 'rate_limited';
  errorMessage: string | null;
  idempotencyKey: string | null;
  durationMs: number | null;
  ts: string;
}> = [];
let auditLoading = false;
let walletsList: Array<{ id: string; name: string }> = [];

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { ms?: number }) =>
      opts?.ms !== undefined ? `${opts.ms}ms` : key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@renderer/utils/trpc', () => ({
  trpc: {
    mcp: {
      listAudit: { useQuery: () => ({ data: auditRows, isLoading: auditLoading }) },
    },
    wallet: {
      list: { useQuery: () => ({ data: walletsList, isLoading: false }) },
    },
  },
}));

import { AgentActivityPanel } from './AgentActivityPanel';

const renderPanel = () =>
  render(
    <ChakraProvider value={defaultSystem}>
      <AgentActivityPanel />
    </ChakraProvider>,
  );

describe('AgentActivityPanel', () => {
  beforeEach(() => {
    auditRows = [];
    auditLoading = false;
    walletsList = [];
  });

  it('shows the empty state when there are no rows', () => {
    renderPanel();
    expect(screen.getByText('settings.security.agentActivity.empty')).toBeInTheDocument();
  });

  it('shows a loading state while fetching', () => {
    auditLoading = true;
    renderPanel();
    expect(screen.getByText('settings.security.agentActivity.loading')).toBeInTheDocument();
  });

  it('renders rows with tool, wallet name, status label, and duration', () => {
    walletsList = [{ id: 'w1', name: 'Paper #1' }];
    auditRows = [
      {
        id: 1,
        walletId: 'w1',
        tool: 'trading.place_order',
        status: 'success',
        errorMessage: null,
        idempotencyKey: null,
        durationMs: 137,
        ts: '2026-04-30T19:00:00Z',
      },
      {
        id: 2,
        walletId: 'w1',
        tool: 'trading.place_order',
        status: 'denied',
        errorMessage: 'agent trading is disabled for this wallet',
        idempotencyKey: null,
        durationMs: null,
        ts: '2026-04-30T19:01:00Z',
      },
    ];
    renderPanel();

    expect(screen.getByTestId('agent-activity-table')).toBeInTheDocument();
    expect(screen.getAllByText('trading.place_order')).toHaveLength(2);
    expect(screen.getAllByText('Paper #1')).toHaveLength(2);
    expect(screen.getByText('settings.security.agentActivity.status.success')).toBeInTheDocument();
    expect(screen.getByText('settings.security.agentActivity.status.denied')).toBeInTheDocument();
    expect(screen.getByText('137ms')).toBeInTheDocument();
    expect(screen.getByText(/agent trading is disabled for this wallet/i)).toBeInTheDocument();
  });

  it('falls back to wallet id when the wallet is no longer in the list', () => {
    auditRows = [
      {
        id: 3,
        walletId: 'w-deleted',
        tool: 'trading.cancel_order',
        status: 'failure',
        errorMessage: 'order not found',
        idempotencyKey: null,
        durationMs: 22,
        ts: '2026-04-30T19:02:00Z',
      },
    ];
    renderPanel();
    expect(screen.getByText('w-deleted')).toBeInTheDocument();
    expect(screen.getByText('settings.security.agentActivity.status.failure')).toBeInTheDocument();
  });

  it('shows a placeholder for rows with no walletId', () => {
    auditRows = [
      {
        id: 4,
        walletId: null,
        tool: 'health.check',
        status: 'success',
        errorMessage: null,
        idempotencyKey: null,
        durationMs: 4,
        ts: '2026-04-30T19:03:00Z',
      },
    ];
    renderPanel();
    expect(screen.getByText('health.check')).toBeInTheDocument();
    expect(screen.getByText('settings.security.agentActivity.noWallet')).toBeInTheDocument();
  });
});
