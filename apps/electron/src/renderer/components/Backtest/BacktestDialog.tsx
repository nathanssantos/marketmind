import { Box, Flex, VStack } from '@chakra-ui/react';
import { Callout, FormDialog, LoadingSpinner } from '@renderer/components/ui';
import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import { useBacktestDialogStore } from '../../store/backtestDialogStore';
import { useBacktestRun } from '../../hooks/useBacktestRun';
import { useBacktestShortcut } from '../../hooks/useBacktestShortcut';
import { useDialogMount } from '../../hooks/useDialogMount';
import { perfMonitor } from '../../utils/canvas/perfMonitor';
import { BacktestForm } from './BacktestForm';
import { BacktestProgress } from './BacktestProgress';
import { BacktestResults } from './BacktestResults';
import { RecentRunsPanel } from './RecentRunsPanel';
import type { BacktestResult } from '@marketmind/types';

export const BacktestDialog = () => {
  const { t } = useTranslation();
  const { isBacktestOpen, closeBacktest } = useBacktestDialogStore(
    useShallow((state) => ({
      isBacktestOpen: state.isBacktestOpen,
      closeBacktest: state.closeBacktest,
    })),
  );

  const run = useBacktestRun();
  useBacktestShortcut();
  useDialogMount('BacktestDialog', isBacktestOpen);

  useEffect(() => {
    if (isBacktestOpen) perfMonitor.recordComponentRender('BacktestDialog');
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
          <Callout tone="danger" title={t('backtest.failed.title')}>
            {run.error ?? t('backtest.failed.unknown')}
          </Callout>
        </VStack>
      )}
    </FormDialog>
  );
};
