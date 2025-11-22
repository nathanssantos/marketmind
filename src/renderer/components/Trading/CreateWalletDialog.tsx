import { Button, DialogBackdrop, DialogBody, DialogCloseTrigger, DialogContent, DialogFooter, DialogHeader, DialogRoot, DialogTitle, Input, Stack } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { NativeSelectField, NativeSelectRoot } from '@chakra-ui/react/native-select';
import type { WalletCurrency } from '@shared/types/trading';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CreateWalletDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (params: {
    name: string;
    initialBalance: number;
    currency: WalletCurrency;
  }) => void;
}

export const CreateWalletDialog = ({ isOpen, onClose, onCreate }: CreateWalletDialogProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('10000');
  const [currency, setCurrency] = useState<WalletCurrency>('USD');

  const handleSubmit = () => {
    if (!name.trim()) return;
    const balance = parseFloat(initialBalance);
    if (isNaN(balance) || balance <= 0) return;

    onCreate({ name: name.trim(), initialBalance: balance, currency });
    setName('');
    setInitialBalance('10000');
    setCurrency('USD');
    onClose();
  };

  const handleClose = () => {
    setName('');
    setInitialBalance('10000');
    setCurrency('USD');
    onClose();
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && handleClose()} size="md">
      <DialogBackdrop />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('trading.wallets.createTitle')}</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />

        <DialogBody>
          <Stack gap={4}>
            <ChakraField.Root>
              <ChakraField.Label>{t('trading.wallets.name')}</ChakraField.Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('trading.wallets.namePlaceholder')}
              />
            </ChakraField.Root>

            <ChakraField.Root>
              <ChakraField.Label>{t('trading.wallets.initialBalance')}</ChakraField.Label>
              <Input
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                min="1"
                step="100"
              />
            </ChakraField.Root>

            <ChakraField.Root>
              <ChakraField.Label>{t('trading.wallets.currency')}</ChakraField.Label>
              <NativeSelectRoot>
                <NativeSelectField
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as WalletCurrency)}
                >
                  <option value="USD">USD ($)</option>
                  <option value="BRL">BRL (R$)</option>
                  <option value="EUR">EUR (€)</option>
                </NativeSelectField>
              </NativeSelectRoot>
            </ChakraField.Root>
          </Stack>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button
            colorPalette="blue"
            onClick={handleSubmit}
            disabled={!name.trim() || parseFloat(initialBalance) <= 0}
          >
            {t('trading.wallets.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
