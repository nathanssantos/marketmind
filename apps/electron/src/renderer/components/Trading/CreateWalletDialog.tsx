import { Flex, Stack, Text } from '@chakra-ui/react';
import { Callout, Field, FormDialog, Input, Link, NumberInput, Select } from '@renderer/components/ui';
import { CURRENCY_SYMBOLS, DEFAULT_CURRENCY, SELECTABLE_CURRENCIES, type DialogControlProps, type WalletCurrency, type ExchangeId } from '@marketmind/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuExternalLink } from 'react-icons/lu';

const CURRENCY_SELECT_OPTIONS = SELECTABLE_CURRENCIES.map((c) => ({
  value: c,
  label: c === CURRENCY_SYMBOLS[c] ? c : `${c} (${CURRENCY_SYMBOLS[c]})`,
}));

type WalletType = 'paper' | 'testnet' | 'live';
type IBConnectionType = 'gateway' | 'tws';

interface CreateWalletDialogProps extends DialogControlProps {
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
  const [exchange, setExchange] = useState<ExchangeId>('BINANCE');
  const [walletType, setWalletType] = useState<WalletType>('paper');
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('10000');
  const [currency, setCurrency] = useState<WalletCurrency>(DEFAULT_CURRENCY);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [ibConnectionType, setIbConnectionType] = useState<IBConnectionType>('gateway');
  const [ibPort, setIbPort] = useState('4002');
  const [error, setError] = useState<string | null>(null);

  const isBinance = exchange === 'BINANCE';
  const isIB = exchange === 'INTERACTIVE_BROKERS';

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
    setCurrency(DEFAULT_CURRENCY);
    setApiKey('');
    setApiSecret('');
    setWalletType('paper');
    setExchange('BINANCE');
    setIbConnectionType('gateway');
    setIbPort('4002');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isValid = name.trim() && (
    isIB
      ? ibPort.trim().length > 0
      : walletType === 'paper'
        ? parseFloat(initialBalance) > 0
        : apiKey.trim() && apiSecret.trim()
  );

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={t('trading.wallets.createTitle')}
      onSubmit={() => { void handleSubmit(); }}
      submitLabel={t('trading.wallets.create')}
      submitColorPalette={walletType === 'live' ? 'red' : 'blue'}
      submitDisabled={!isValid}
      isLoading={isCreating}
    >
      <Stack gap={3}>
        <Field label={t('trading.wallets.exchange')}>
          <Select
            size="xs"
            value={exchange}
            onChange={(value) => {
              setExchange(value as ExchangeId);
              if (value === 'INTERACTIVE_BROKERS') {
                setCurrency('USD');
                setWalletType('paper');
              }
            }}
            options={[
              { value: 'BINANCE', label: `🪙 Binance (Crypto)` },
              { value: 'INTERACTIVE_BROKERS', label: `📈 Interactive Brokers (Stocks)` },
            ]}
            usePortal={false}
          />
        </Field>

        <Field label={t('trading.wallets.walletType')}>
          <Select
            size="xs"
            value={walletType}
            onChange={(value) => setWalletType(value as WalletType)}
            options={isBinance ? [
              { value: 'paper', label: `📝 ${t('trading.wallets.paper')}` },
              { value: 'testnet', label: `🧪 ${t('trading.wallets.testnet')}` },
              { value: 'live', label: `🔴 ${t('trading.wallets.live')}` },
            ] : [
              { value: 'paper', label: `📝 ${t('trading.wallets.ibPaper')}` },
              { value: 'live', label: `🔴 ${t('trading.wallets.ibLive')}` },
            ]}
            usePortal={false}
          />
        </Field>

        {isBinance && walletType === 'testnet' && (
          <Callout tone="info" title={t('trading.wallets.testnetInfo')} compact>
            <Text mb={1}>{t('trading.wallets.testnetDescription')}</Text>
            <Flex gap={3}>
              <Link href="https://testnet.binance.vision/" target="_blank" color="blue.fg" fontSize="2xs">
                Spot Testnet <LuExternalLink style={{ display: 'inline' }} />
              </Link>
              <Link href="https://testnet.binancefuture.com/" target="_blank" color="blue.fg" fontSize="2xs">
                Futures Testnet <LuExternalLink style={{ display: 'inline' }} />
              </Link>
            </Flex>
          </Callout>
        )}

        {isIB && (
          <Callout tone="info" title={t('trading.wallets.ibInfo')} compact>
            <Text mb={1}>{t('trading.wallets.ibDescription')}</Text>
            <Link href="https://www.interactivebrokers.com/en/trading/ibgateway-stable.php" target="_blank" color="blue.fg" fontSize="2xs">
              {t('trading.wallets.downloadGateway')} <LuExternalLink style={{ display: 'inline' }} />
            </Link>
          </Callout>
        )}

        {walletType === 'live' && (
          <Callout tone="warning" title={t('trading.wallets.liveWarning')} compact>
            {t('trading.wallets.liveDescription')}
          </Callout>
        )}

        <Field label={t('trading.wallets.name')}>
          <Input
            size="xs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('trading.wallets.namePlaceholder')}
          />
        </Field>

        {isIB && (
          <>
            <Field label={t('trading.wallets.connectionType')}>
              <Select
                size="xs"
                value={ibConnectionType}
                onChange={(value) => setIbConnectionType(value as IBConnectionType)}
                options={[
                  { value: 'gateway', label: t('trading.wallets.ibGateway') },
                  { value: 'tws', label: t('trading.wallets.ibTws') },
                ]}
                usePortal={false}
              />
            </Field>

            <Field label={t('trading.wallets.port')}>
              <Input
                size="xs"
                value={ibPort}
                onChange={(e) => setIbPort(e.target.value)}
                placeholder={walletType === 'paper' ? '4002' : '4001'}
              />
            </Field>
          </>
        )}

        {isBinance && walletType === 'paper' && (
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
                options={CURRENCY_SELECT_OPTIONS}
                usePortal={false}
              />
            </Field>
          </>
        )}

        {isBinance && walletType !== 'paper' && (
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
          <Callout tone="danger" compact>
            {error}
          </Callout>
        )}
      </Stack>
    </FormDialog>
  );
};
