import { CloseButton } from '@chakra-ui/react';
import { Dialog } from '@renderer/components/ui/dialog';
import { BacktestingPanel } from './BacktestingPanel';

interface BacktestDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BacktestDialog = ({ isOpen, onClose }: BacktestDialogProps) => {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="xl">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxH="90vh">
          <CloseButton
            position="absolute"
            top={4}
            right={4}
            onClick={onClose}
            size="sm"
          />
          <Dialog.Header>
            <Dialog.Title>Strategy Backtesting</Dialog.Title>
          </Dialog.Header>

          <Dialog.Body overflowY="auto" p={0}>
            <BacktestingPanel />
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
