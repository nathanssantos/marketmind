import { Button, DialogBackdrop, DialogBody, DialogCloseTrigger, DialogContent, DialogFooter, DialogHeader, DialogRoot, DialogTitle, Stack } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { Input } from '@renderer/components/ui/input';
import { NumberInput } from '@renderer/components/ui/number-input';
import { Select } from '@renderer/components/ui/select';
import type { WalletCurrency } from '@marketmind/types';
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
                size="xs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('trading.wallets.namePlaceholder')}
              />
            </ChakraField.Root>

            <ChakraField.Root>
              <ChakraField.Label>{t('trading.wallets.initialBalance')}</ChakraField.Label>
              <NumberInput
                size="xs"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                min={1}
                step={100}
              />
            </ChakraField.Root>

            <ChakraField.Root>
              <ChakraField.Label>{t('trading.wallets.currency')}</ChakraField.Label>
              <Select
                size="xs"
                value={currency}
                onChange={(value) => setCurrency(value as WalletCurrency)}
                options={[
                  { value: 'USD', label: 'USD ($)' },
                  { value: 'BRL', label: 'BRL (R$)' },
                  { value: 'EUR', label: 'EUR (€)' },
                ]}
                usePortal={false}
              />
            </ChakraField.Root>
          </Stack>
        </DialogBody>

        <DialogFooter>
          <Button size="2xs" variant="ghost" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button
            size="2xs"
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
