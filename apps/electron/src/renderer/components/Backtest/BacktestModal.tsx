import { Text, VStack } from '@chakra-ui/react';
import { FormDialog } from '@renderer/components/ui';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import { useBacktestModalStore } from '../../store/backtestModalStore';

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
      size="lg"
      contentMaxH="80vh"
      hideFooter
    >
      <VStack align="stretch" gap={3} py={4}>
        <Text color="fg.muted" fontSize="sm">
          {t('backtest.comingSoon')}
        </Text>
      </VStack>
    </FormDialog>
  );
};
