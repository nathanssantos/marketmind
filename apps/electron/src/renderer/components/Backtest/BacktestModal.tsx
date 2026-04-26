import { Box, Flex, VStack } from '@chakra-ui/react';
import { Alert, FormDialog, LoadingSpinner } from '@renderer/components/ui';
import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import { useBacktestModalStore } from '../../store/backtestModalStore';
import { useBacktestRun } from '../../hooks/useBacktestRun';
import { useBacktestShortcut } from '../../hooks/useBacktestShortcut';
import { perfMonitor } from '../../utils/canvas/perfMonitor';
import { BacktestForm } from './BacktestForm';
import { BacktestProgress } from './BacktestProgress';
import { BacktestResults } from './BacktestResults';
import { RecentRunsPanel } from './RecentRunsPanel';
import type { BacktestResult } from '@marketmind/types';

export const BacktestModal = () => {
  const { t } = useTranslation();
  const { isBacktestOpen, closeBacktest } = useBacktestModalStore(
    useShallow((state) => ({
      isBacktestOpen: state.isBacktestOpen,
      closeBacktest: state.closeBacktest,
    })),
  );

  const run = useBacktestRun();
  useBacktestShortcut();

  useEffect(() => {
    if (isBacktestOpen) perfMonitor.recordComponentRender('BacktestModal');
  }, [isBacktestOpen]);

  const handleClose = () => {
    run.reset();
    closeBacktest();
  };

  return (
    <FormDialog
      isOpen={isBacktestOpen}
      onClose={handleClose}
      title={t('backtest.title')}
      size="xl"
      contentMaxH="85vh"
      hideFooter
    >
      {run.status === 'idle' && (
        <VStack align="stretch" gap={3}>
          <BacktestForm onClose={handleClose} onRun={(input) => void run.start(input)} />
          <RecentRunsPanel onSelect={(id) => run.viewResult(id)} />
        </VStack>
      )}

      {run.status === 'running' && (
        <BacktestProgress progress={run.progress} onCancel={() => run.reset()} />
      )}

      {run.status === 'success' && run.result?.status === 'COMPLETED' && (
        <BacktestResults
          result={run.result as BacktestResult}
          onRunAnother={() => run.reset()}
        />
      )}

      {run.status === 'success' && run.isFetchingResult && (
        <Box py={8}><Flex justify="center"><LoadingSpinner /></Flex></Box>
      )}

      {run.status === 'failed' && (
        <VStack align="stretch" gap={3} py={4}>
          <Alert.Root status="error">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t('backtest.failed.title')}</Alert.Title>
              <Alert.Description>{run.error ?? t('backtest.failed.unknown')}</Alert.Description>
            </Alert.Content>
          </Alert.Root>
        </VStack>
      )}
    </FormDialog>
  );
};
