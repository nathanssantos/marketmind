import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { Button, Tabs } from '@renderer/components/ui';
import {
  getDefaultBacktestInput,
  simpleBacktestInputSchema,
  type SimpleBacktestInput,
} from '@marketmind/types';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BasicTab } from './tabs/BasicTab';
import { FiltersTab } from './tabs/FiltersTab';
import { RiskTab } from './tabs/RiskTab';
import { StrategiesTab } from './tabs/StrategiesTab';

export type SetField = <K extends keyof SimpleBacktestInput>(
  key: K,
  value: SimpleBacktestInput[K],
) => void;

interface BacktestFormProps {
  onClose: () => void;
}

export const BacktestForm = ({ onClose }: BacktestFormProps) => {
  const { t } = useTranslation();
  const [state, setState] = useState<SimpleBacktestInput>(() => getDefaultBacktestInput());

  const setField: SetField = useCallback((key, value) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const validation = useMemo(() => simpleBacktestInputSchema.safeParse(state), [state]);
  const fieldErrors = useMemo<Record<string, string>>(() => {
    if (validation.success) return {};
    const out: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      const path = issue.path.join('.');
      if (path && !out[path]) out[path] = issue.message;
    }
    return out;
  }, [validation]);

  const isValid = validation.success;

  return (
    <VStack align="stretch" gap={3} h="100%">
      <Tabs.Root defaultValue="basic" variant="line">
        <Tabs.List>
          <Tabs.Trigger value="basic">{t('backtest.tabs.basic')}</Tabs.Trigger>
          <Tabs.Trigger value="strategies">{t('backtest.tabs.strategies')}</Tabs.Trigger>
          <Tabs.Trigger value="filters">{t('backtest.tabs.filters')}</Tabs.Trigger>
          <Tabs.Trigger value="risk">{t('backtest.tabs.risk')}</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="basic" px={0} py={4}>
          <BasicTab state={state} setField={setField} fieldErrors={fieldErrors} />
        </Tabs.Content>
        <Tabs.Content value="strategies" px={0} py={4}>
          <StrategiesTab state={state} setField={setField} />
        </Tabs.Content>
        <Tabs.Content value="filters" px={0} py={4}>
          <FiltersTab state={state} setField={setField} fieldErrors={fieldErrors} />
        </Tabs.Content>
        <Tabs.Content value="risk" px={0} py={4}>
          <RiskTab state={state} setField={setField} fieldErrors={fieldErrors} />
        </Tabs.Content>
      </Tabs.Root>

      <Box flexShrink={0} pt={2} borderTopWidth="1px" borderColor="border">
        <HStack justify="space-between">
          {!isValid ? (
            <Text fontSize="xs" color="fg.error">
              {t('backtest.form.invalid', { count: validation.error?.issues.length ?? 0 })}
            </Text>
          ) : (
            <Text fontSize="xs" color="fg.muted">
              {t('backtest.form.ready')}
            </Text>
          )}
          <HStack gap={2}>
            <Button size="2xs" variant="ghost" onClick={onClose} px={3}>
              {t('common.cancel')}
            </Button>
            <Button
              size="2xs"
              colorPalette="blue"
              disabled={!isValid}
              px={3}
              data-testid="backtest-submit"
            >
              {t('backtest.form.run')}
            </Button>
          </HStack>
        </HStack>
      </Box>
    </VStack>
  );
};
