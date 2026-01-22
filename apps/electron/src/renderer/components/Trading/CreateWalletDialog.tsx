import { Alert, Box, Flex, Link, Stack, Text } from '@chakra-ui/react';
import { Field } from '@renderer/components/ui/field';
import { FormDialog } from '@renderer/components/ui/FormDialog';
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
    <FormDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={t('trading.wallets.createTitle')}
      onSubmit={handleSubmit}
      submitLabel={t('trading.wallets.create')}
      submitColorPalette={walletType === 'live' ? 'red' : 'blue'}
      submitDisabled={!isValid}
      isLoading={isCreating}
    >
      <Stack gap={4}>
        <Field label={t('trading.wallets.walletType', 'Wallet Type')}>
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
        </Field>

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

        <Field label={t('trading.wallets.name')}>
          <Input
            size="xs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('trading.wallets.namePlaceholder')}
          />
        </Field>

        {walletType === 'paper' ? (
          <>
            <Field label={t('trading.wallets.initialBalance')}>
              <NumberInput
                size="xs"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                min={1}
                step={100}
              />
            </Field>

            <Field label={t('trading.wallets.currency')}>
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
            </Field>
          </>
        ) : (
          <>
            <Field label="API Key">
              <Input
                size="xs"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Binance API Key"
                fontFamily="mono"
              />
            </Field>

            <Field label="API Secret">
              <Input
                size="xs"
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Enter your Binance API Secret"
                fontFamily="mono"
              />
            </Field>
          </>
        )}

        {error && (
          <Alert.Root status="error" size="sm">
            <Alert.Indicator />
            <Alert.Description fontSize="xs">{error}</Alert.Description>
          </Alert.Root>
        )}
      </Stack>
    </FormDialog>
  );
};
