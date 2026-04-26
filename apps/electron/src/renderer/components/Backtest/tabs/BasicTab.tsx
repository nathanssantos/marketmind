import { Grid, GridItem, Input } from '@chakra-ui/react';
import { Field, NumberInput, Select } from '@renderer/components/ui';
import type { MarketType, SimpleBacktestInput, TimeInterval } from '@marketmind/types';
import { BACKTEST_TIMEFRAMES } from '@marketmind/types';
import { useTranslation } from 'react-i18next';
import { SymbolSelector } from '../../SymbolSelector';
import type { SetField } from '../BacktestForm';

interface BasicTabProps {
  state: SimpleBacktestInput;
  setField: SetField;
  fieldErrors: Record<string, string>;
}

const MARKET_TYPE_OPTIONS = [
  { value: 'FUTURES', label: 'Futures' },
  { value: 'SPOT', label: 'Spot' },
];

export const BasicTab = ({ state, setField, fieldErrors }: BasicTabProps) => {
  const { t } = useTranslation();

  const intervalOptions = BACKTEST_TIMEFRAMES.map((iv) => ({ value: iv, label: iv }));
  const isFutures = (state.marketType ?? 'FUTURES') === 'FUTURES';

  return (
    <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
      <GridItem colSpan={{ base: 1, md: 2 }}>
        <Field label={t('backtest.basic.symbol')} invalid={!!fieldErrors['symbol']} errorText={fieldErrors['symbol']}>
          <SymbolSelector
            value={state.symbol}
            onChange={(symbol, marketType) => {
              setField('symbol', symbol);
              if (marketType) setField('marketType', marketType);
            }}
            marketType={state.marketType}
            onMarketTypeChange={(marketType) => setField('marketType', marketType)}
            showMarketTypeToggle
          />
        </Field>
      </GridItem>

      <Field label={t('backtest.basic.marketType')}>
        <Select
          value={state.marketType ?? 'FUTURES'}
          options={MARKET_TYPE_OPTIONS}
          onChange={(value) => setField('marketType', value as MarketType)}
          usePortal={false}
        />
      </Field>

      <Field label={t('backtest.basic.interval')}>
        <Select
          value={state.interval}
          options={intervalOptions}
          onChange={(value) => setField('interval', value as TimeInterval)}
          usePortal={false}
        />
      </Field>

      <Field label={t('backtest.basic.startDate')} invalid={!!fieldErrors['startDate']} errorText={fieldErrors['startDate']}>
        <Input
          type="date"
          value={state.startDate}
          onChange={(e) => setField('startDate', e.target.value)}
        />
      </Field>

      <Field label={t('backtest.basic.endDate')} invalid={!!fieldErrors['endDate']} errorText={fieldErrors['endDate']}>
        <Input
          type="date"
          value={state.endDate}
          onChange={(e) => setField('endDate', e.target.value)}
        />
      </Field>

      <Field label={t('backtest.basic.initialCapital')} invalid={!!fieldErrors['initialCapital']} errorText={fieldErrors['initialCapital']}>
        <NumberInput
          value={state.initialCapital}
          onChange={(e) => setField('initialCapital', Number(e.target.value))}
          min={1}
          step={100}
        />
      </Field>

      {isFutures && (
        <Field label={t('backtest.basic.leverage')} invalid={!!fieldErrors['leverage']} errorText={fieldErrors['leverage']}>
          <NumberInput
            value={state.leverage ?? 1}
            onChange={(e) => setField('leverage', Number(e.target.value))}
            min={1}
            max={125}
            step={1}
          />
        </Field>
      )}
    </Grid>
  );
};
