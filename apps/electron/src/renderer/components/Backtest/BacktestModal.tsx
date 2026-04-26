import { FormDialog } from '@renderer/components/ui';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import { useBacktestModalStore } from '../../store/backtestModalStore';
import { BacktestForm } from './BacktestForm';

export const BacktestModal = () => {
  const { t } = useTranslation();
  const { isBacktestOpen, closeBacktest } = useBacktestModalStore(
    useShallow((state) => ({
      isBacktestOpen: state.isBacktestOpen,
      closeBacktest: state.closeBacktest,
    })),
  );

  return (
    <FormDialog
      isOpen={isBacktestOpen}
      onClose={closeBacktest}
      title={t('backtest.title')}
      size="xl"
      contentMaxH="85vh"
      hideFooter
    >
      <BacktestForm onClose={closeBacktest} />
    </FormDialog>
  );
};
