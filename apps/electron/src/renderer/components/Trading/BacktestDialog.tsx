import { CloseButton } from '@chakra-ui/react';
import { Dialog } from '@renderer/components/ui/dialog';
import type { MarketDataService } from '@renderer/services/market/MarketDataService';
import { BacktestingPanel } from './BacktestingPanel';

interface BacktestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  marketService?: MarketDataService;
}

export const BacktestDialog = ({ isOpen, onClose, marketService }: BacktestDialogProps) => {
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
            <BacktestingPanel marketService={marketService} />
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
