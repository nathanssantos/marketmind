import { Box, Text } from '@chakra-ui/react';
import { Badge, FormSection, LoadingSpinner, MetaText, Table } from '@renderer/components/ui';
import { trpc } from '@renderer/utils/trpc';
import { useTranslation } from 'react-i18next';

const STATUS_PALETTE = {
  success: 'green',
  failure: 'red',
  denied: 'orange',
  rate_limited: 'yellow',
} as const;

type StatusKey = keyof typeof STATUS_PALETTE;

const isStatus = (s: string): s is StatusKey => s in STATUS_PALETTE;

export const AgentActivityPanel = () => {
  const { t, i18n } = useTranslation();
  const auditQuery = trpc.mcp.listAudit.useQuery({ limit: 100 });
  const walletsQuery = trpc.wallet.list.useQuery();

  const walletNameById = new Map((walletsQuery.data ?? []).map((w) => [w.id, w.name]));

  const formatTs = (d: string | Date): string =>
    new Date(d).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'medium' });

  const rows = auditQuery.data ?? [];

  return (
    <FormSection
      title={t('settings.security.agentActivity.title')}
      description={t('settings.security.agentActivity.description')}
    >
      {auditQuery.isLoading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <MetaText>{t('settings.security.agentActivity.empty')}</MetaText>
      ) : (
        <Box overflowX="auto" data-testid="agent-activity-table">
          <Table.Root size="sm" variant="line">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>{t('settings.security.agentActivity.columns.ts')}</Table.ColumnHeader>
                <Table.ColumnHeader>{t('settings.security.agentActivity.columns.tool')}</Table.ColumnHeader>
                <Table.ColumnHeader>{t('settings.security.agentActivity.columns.wallet')}</Table.ColumnHeader>
                <Table.ColumnHeader>{t('settings.security.agentActivity.columns.status')}</Table.ColumnHeader>
                <Table.ColumnHeader>{t('settings.security.agentActivity.columns.duration')}</Table.ColumnHeader>
                <Table.ColumnHeader>{t('settings.security.agentActivity.columns.details')}</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => {
                const status = row.status;
                const palette = isStatus(status) ? STATUS_PALETTE[status] : 'gray';
                const statusLabel = isStatus(status)
                  ? t(`settings.security.agentActivity.status.${status}`)
                  : status;
                return (
                  <Table.Row key={row.id} data-testid={`agent-activity-row-${row.id}`}>
                    <Table.Cell>
                      <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap">
                        {formatTs(row.ts)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="xs" fontFamily="mono">{row.tool}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="xs">
                        {row.walletId ? (walletNameById.get(row.walletId) ?? row.walletId) : t('settings.security.agentActivity.noWallet')}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge colorPalette={palette} size="sm">{statusLabel}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap">
                        {row.durationMs != null ? t('settings.security.agentActivity.durationMs', { ms: row.durationMs }) : '—'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="xs" color="fg.muted" lineClamp={1} maxW="32ch">
                        {row.errorMessage ?? ''}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Box>
      )}
    </FormSection>
  );
};
