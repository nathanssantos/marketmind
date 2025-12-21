import { Alert, Box, Button, DialogBackdrop, DialogBody, DialogCloseTrigger, DialogContent, DialogFooter, DialogHeader, DialogRoot, DialogTitle, Flex, Link, Stack, Text } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import type { WalletCurrency } from '@marketmind/types';
import { Input } from '@renderer/components/ui/input';
import { NumberInput } from '@renderer/components/ui/number-input';
import { Select } from '@renderer/components/ui/select';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuExternalLink, LuInfo } from 'react-icons/lu';

type WalletType = 'paper' | 'testnet' | 'live';

interface CreateWalletDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (params: {
    name: string;
    initialBalance: number;
    currency: WalletCurrency;
  }) => void;
  onCreateReal?: (params: {
    name: string;
    apiKey: string;
    apiSecret: string;
    walletType: 'testnet' | 'live';
  }) => Promise<void>;
  isCreating?: boolean;
}

export const CreateWalletDialog = ({ isOpen, onClose, onCreate, onCreateReal, isCreating = false }: CreateWalletDialogProps) => {
  const { t } = useTranslation();
  const [walletType, setWalletType] = useState<WalletType>('paper');
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('10000');
  const [currency, setCurrency] = useState<WalletCurrency>('USDT');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setError(null);

    if (walletType === 'paper') {
      const balance = parseFloat(initialBalance);
      if (isNaN(balance) || balance <= 0) return;
      onCreate({ name: name.trim(), initialBalance: balance, currency });
      resetForm();
      onClose();
    } else {
      if (!apiKey.trim() || !apiSecret.trim()) {
        setError('API Key and Secret are required');
        return;
      }

      if (!onCreateReal) {
        setError('Real wallet creation not available');
        return;
      }

      try {
        await onCreateReal({
          name: name.trim(),
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
          walletType,
        });
        resetForm();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create wallet');
      }
    }
  };

  const resetForm = () => {
    setName('');
    setInitialBalance('10000');
    setCurrency('USDT');
    setApiKey('');
    setApiSecret('');
    setWalletType('paper');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isValid = name.trim() && (
    walletType === 'paper'
      ? parseFloat(initialBalance) > 0
      : apiKey.trim() && apiSecret.trim()
  );

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
              <ChakraField.Label>{t('trading.wallets.walletType', 'Wallet Type')}</ChakraField.Label>
              <Select
                size="xs"
                value={walletType}
                onChange={(value) => setWalletType(value as WalletType)}
                options={[
                  { value: 'paper', label: `📝 ${t('trading.wallets.paper', 'Paper Trading')}` },
                  { value: 'testnet', label: `🧪 ${t('trading.wallets.testnet', 'Binance Testnet')}` },
                  { value: 'live', label: `🔴 ${t('trading.wallets.live', 'Live Trading')}` },
                ]}
                usePortal={false}
              />
            </ChakraField.Root>

            {walletType === 'testnet' && (
              <Alert.Root status="info" size="sm">
                <Alert.Indicator>
                  <LuInfo />
                </Alert.Indicator>
                <Box>
                  <Alert.Title fontSize="xs">{t('trading.wallets.testnetInfo', 'Binance Testnet')}</Alert.Title>
                  <Alert.Description fontSize="xs">
                    <Text mb={1}>{t('trading.wallets.testnetDescription', 'Use testnet to practice with fake funds.')}</Text>
                    <Flex gap={3}>
                      <Link href="https://testnet.binance.vision/" target="_blank" color="blue.500" fontSize="xs">
                        Spot Testnet <LuExternalLink style={{ display: 'inline' }} />
                      </Link>
                      <Link href="https://testnet.binancefuture.com/" target="_blank" color="blue.500" fontSize="xs">
                        Futures Testnet <LuExternalLink style={{ display: 'inline' }} />
                      </Link>
                    </Flex>
                  </Alert.Description>
                </Box>
              </Alert.Root>
            )}

            {walletType === 'live' && (
              <Alert.Root status="warning" size="sm">
                <Alert.Indicator>
                  <LuInfo />
                </Alert.Indicator>
                <Box>
                  <Alert.Title fontSize="xs">{t('trading.wallets.liveWarning', 'Warning: Real Money')}</Alert.Title>
                  <Alert.Description fontSize="xs">
                    {t('trading.wallets.liveDescription', 'Live trading uses real funds. Make sure you understand the risks.')}
                  </Alert.Description>
                </Box>
              </Alert.Root>
            )}

            <ChakraField.Root>
              <ChakraField.Label>{t('trading.wallets.name')}</ChakraField.Label>
              <Input
                size="xs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('trading.wallets.namePlaceholder')}
              />
            </ChakraField.Root>

            {walletType === 'paper' ? (
              <>
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
                      { value: 'USDT', label: 'USDT' },
                      { value: 'USD', label: 'USD ($)' },
                      { value: 'BRL', label: 'BRL (R$)' },
                      { value: 'EUR', label: 'EUR (€)' },
                    ]}
                    usePortal={false}
                  />
                </ChakraField.Root>
              </>
            ) : (
              <>
                <ChakraField.Root>
                  <ChakraField.Label>API Key</ChakraField.Label>
                  <Input
                    size="xs"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Binance API Key"
                    fontFamily="mono"
                  />
                </ChakraField.Root>

                <ChakraField.Root>
                  <ChakraField.Label>API Secret</ChakraField.Label>
                  <Input
                    size="xs"
                    type="password"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder="Enter your Binance API Secret"
                    fontFamily="mono"
                  />
                </ChakraField.Root>
              </>
            )}

            {error && (
              <Alert.Root status="error" size="sm">
                <Alert.Indicator />
                <Alert.Description fontSize="xs">{error}</Alert.Description>
              </Alert.Root>
            )}
          </Stack>
        </DialogBody>

        <DialogFooter>
          <Button size="2xs" variant="ghost" onClick={handleClose} disabled={isCreating}>
            {t('common.cancel')}
          </Button>
          <Button
            size="2xs"
            colorPalette={walletType === 'live' ? 'red' : 'blue'}
            onClick={handleSubmit}
            disabled={!isValid || isCreating}
            loading={isCreating}
          >
            {t('trading.wallets.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
