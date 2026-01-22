import { FormDialog } from '@renderer/components/ui/FormDialog';
import { BacktestingPanel } from './BacktestingPanel';

interface BacktestDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BacktestDialog = ({ isOpen, onClose }: BacktestDialogProps) => (
  <FormDialog
    isOpen={isOpen}
    onClose={onClose}
    title="Strategy Backtesting"
    size="xl"
    hideFooter
    bodyPadding={0}
    contentMaxH="90vh"
  >
    <BacktestingPanel />
  </FormDialog>
);
