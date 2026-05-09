import type { MarketType } from '@marketmind/types';
import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPlus, LuRefreshCw, LuTrash2, LuX } from 'react-icons/lu';
import { useBackendCustomSymbols } from '../../hooks/useBackendCustomSymbols';
import { toaster } from '../../utils/toaster';
import { Badge, Button, EmptyState, Field, IconButton, Input, RecordRow, Tabs } from '../ui';

const CATEGORIES = ['politics', 'defi', 'gaming', 'ai', 'other'] as const;
const WEIGHTING_METHODS = ['EQUAL', 'MARKET_CAP', 'CAPPED_MARKET_CAP', 'SQRT_MARKET_CAP', 'MANUAL'] as const;

interface ComponentInput {
  symbol: string;
  marketType: MarketType;
  coingeckoId: string;
}

const categoryColor = (cat: string): string => {
  const map: Record<string, string> = { politics: 'purple', defi: 'blue', gaming: 'green', ai: 'orange', other: 'gray' };
  return map[cat] ?? 'gray';
};

export const CustomSymbolsTab = memo(() => {
  const { t } = useTranslation();
  const {
    customSymbols,
    createCustomSymbol,
    deleteCustomSymbol,
    rebalanceCustomSymbol,
  } = useBackendCustomSymbols();

  const [formSymbol, setFormSymbol] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<typeof CATEGORIES[number]>('other');
  const [formMethod, setFormMethod] = useState<typeof WEIGHTING_METHODS[number]>('CAPPED_MARKET_CAP');
  const [formCapPercent, setFormCapPercent] = useState(40);
  const [formBaseValue, setFormBaseValue] = useState(100);
  const [formComponents, setFormComponents] = useState<ComponentInput[]>([
    { symbol: '', marketType: 'FUTURES', coingeckoId: '' },
    { symbol: '', marketType: 'FUTURES', coingeckoId: '' },
  ]);

  const addComponent = () => {
    setFormComponents((prev) => [...prev, { symbol: '', marketType: 'FUTURES', coingeckoId: '' }]);
  };

  const removeComponent = (index: number) => {
    if (formComponents.length <= 2) return;
    setFormComponents((prev) => prev.filter((_, i) => i !== index));
  };

  const updateComponent = (index: number, field: keyof ComponentInput, value: string) => {
    setFormComponents((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: field === 'symbol' ? value.toUpperCase() : value } : c)),
    );
  };

  const handleCreate = async () => {
    if (!formSymbol || !formName || formComponents.some((c) => !c.symbol)) return;

    try {
      await createCustomSymbol.mutateAsync({
        symbol: formSymbol.toUpperCase(),
        name: formName,
        category: formCategory,
        baseValue: formBaseValue,
        weightingMethod: formMethod,
        capPercent: formMethod === 'CAPPED_MARKET_CAP' ? formCapPercent : undefined,
        rebalanceIntervalDays: 30,
        components: formComponents.map((c) => ({
          symbol: c.symbol,
          marketType: c.marketType,
          coingeckoId: c.coingeckoId || undefined,
        })),
      });

      setFormSymbol('');
      setFormName('');
      setFormComponents([
        { symbol: '', marketType: 'FUTURES', coingeckoId: '' },
        { symbol: '', marketType: 'FUTURES', coingeckoId: '' },
      ]);
    } catch (err) {
      toaster.create({ title: t('common.error'), description: String(err), type: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCustomSymbol.mutateAsync(id);
    } catch (err) {
      toaster.create({ title: t('common.error'), description: String(err), type: 'error' });
    }
  };

  const handleRebalance = async (id: number) => {
    try {
      await rebalanceCustomSymbol.mutateAsync(id);
    } catch (err) {
      toaster.create({ title: t('common.error'), description: String(err), type: 'error' });
    }
  };

  return (
    <Stack gap={4}>
      <Tabs.Root defaultValue="list" variant="line" size="sm">
      <Tabs.List>
        <Tabs.Trigger value="list" px={3} py={1.5}>
          {t('customSymbols.myIndices')}
        </Tabs.Trigger>
        <Tabs.Trigger value="create" px={3} py={1.5}>
          {t('customSymbols.createNew')}
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="list">
        <Stack gap={3} pt={3}>
          {customSymbols.data?.length === 0 && (
            <EmptyState size="sm" title={t('common.noResults')} />
          )}
          {customSymbols.data?.map((cs) => (
            <RecordRow key={cs.id} density="card">
              <Flex justify="space-between" align="start" mb={2}>
                <HStack gap={2}>
                  <Text fontWeight="semibold" fontSize="sm">{cs.name}</Text>
                  <Badge size="xs" colorPalette="blue">{cs.symbol}</Badge>
                  <Badge size="xs" colorPalette={categoryColor(cs.category)}>
                    {t(`customSymbols.categories.${cs.category}`)}
                  </Badge>
                </HStack>
                <HStack gap={1}>
                  <IconButton
                    size="2xs"
                    variant="ghost"
                    aria-label={t('customSymbols.rebalance')}
                    onClick={() => { void handleRebalance(cs.id); }}
                    disabled={rebalanceCustomSymbol.isPending}
                  >
                    <LuRefreshCw />
                  </IconButton>
                  <IconButton
                    size="2xs"
                    variant="ghost"
                    colorPalette="red"
                    aria-label={t('common.delete')}
                    onClick={() => { void handleDelete(cs.id); }}
                    disabled={deleteCustomSymbol.isPending}
                  >
                    <LuTrash2 />
                  </IconButton>
                </HStack>
              </Flex>
              <HStack gap={1} flexWrap="wrap">
                {cs.components.map((comp) => (
                  <Badge key={comp.id} size="xs" variant="subtle" colorPalette="gray">
                    {comp.symbol} {(comp.weight * 100).toFixed(1)}%
                  </Badge>
                ))}
              </HStack>
              {cs.lastRebalancedAt && (
                <Text fontSize="2xs" color="fg.muted" mt={1}>
                  {t('customSymbols.lastRebalanced')}: {new Date(cs.lastRebalancedAt).toLocaleDateString()}
                </Text>
              )}
            </RecordRow>
          ))}
        </Stack>
      </Tabs.Content>

      <Tabs.Content value="create">
        <Stack gap={3} pt={3}>
          <Flex gap={3}>
            <Box flex={1}>
              <Field label={t('customSymbols.newIndex')}>
                <Input
                  size="xs"
                  placeholder={t('customSymbols.symbolPlaceholder')}
                  value={formSymbol}
                  onChange={(e) => setFormSymbol(e.target.value.toUpperCase())}
                />
              </Field>
            </Box>
            <Box flex={2}>
              <Field label={t('customSymbols.name')}>
                <Input
                  size="xs"
                  placeholder={t('customSymbols.namePlaceholder')}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </Field>
            </Box>
          </Flex>

          <Flex gap={3}>
            <Box flex={1}>
              <Field label={t('customSymbols.category')}>
                <Flex gap={1} flexWrap="wrap">
                  {CATEGORIES.map((cat) => (
                    <Button
                      key={cat}
                      size="2xs"
                      variant={formCategory === cat ? 'solid' : 'outline'}
                      colorPalette={formCategory === cat ? categoryColor(cat) : 'gray'}
                      onClick={() => setFormCategory(cat)}
                    >
                      {t(`customSymbols.categories.${cat}`)}
                    </Button>
                  ))}
                </Flex>
              </Field>
            </Box>
            <Box flex={1}>
              <Field label={t('customSymbols.baseValue')}>
                <Input
                  size="xs"
                  type="number"
                  value={formBaseValue}
                  onChange={(e) => setFormBaseValue(Number(e.target.value))}
                />
              </Field>
            </Box>
          </Flex>

          <Flex gap={3}>
            <Box flex={1}>
              <Field label={t('customSymbols.weightingMethod')}>
                <Flex gap={1} flexWrap="wrap">
                  {WEIGHTING_METHODS.map((m) => (
                    <Button
                      key={m}
                      size="2xs"
                      variant="outline"
                      color={formMethod === m ? 'accent.solid' : 'fg.muted'}
                      onClick={() => setFormMethod(m)}
                    >
                      {t(`customSymbols.methods.${m}`)}
                    </Button>
                  ))}
                </Flex>
              </Field>
            </Box>
            {formMethod === 'CAPPED_MARKET_CAP' && (
              <Box w="100px">
                <Field label={t('customSymbols.capPercent')}>
                  <Input
                    size="xs"
                    type="number"
                    value={formCapPercent}
                    onChange={(e) => setFormCapPercent(Number(e.target.value))}
                  />
                </Field>
              </Box>
            )}
          </Flex>

          <Box>
            <Flex justify="space-between" align="center" mb={2}>
              <Text fontSize="xs" fontWeight="medium">{t('customSymbols.components')}</Text>
              <IconButton size="2xs" variant="ghost" aria-label={t('common.add')} onClick={addComponent}>
                <LuPlus />
              </IconButton>
            </Flex>
            <Stack gap={2}>
              {formComponents.map((comp, i) => (
                <Flex key={i} gap={2} align="center">
                  <Input
                    size="xs"
                    placeholder={t('customSymbols.symbolExample')}
                    value={comp.symbol}
                    onChange={(e) => updateComponent(i, 'symbol', e.target.value)}
                    flex={1}
                  />
                  <Input
                    size="xs"
                    placeholder={t('customSymbols.coingeckoId')}
                    value={comp.coingeckoId}
                    onChange={(e) => updateComponent(i, 'coingeckoId', e.target.value)}
                    flex={1}
                  />
                  <Button
                    size="2xs"
                    variant={comp.marketType === 'SPOT' ? 'solid' : 'outline'}
                    onClick={() => updateComponent(i, 'marketType', comp.marketType === 'SPOT' ? 'FUTURES' : 'SPOT')}
                  >
                    {comp.marketType}
                  </Button>
                  {formComponents.length > 2 && (
                    <IconButton
                      size="2xs"
                      variant="ghost"
                      colorPalette="red"
                      aria-label={t('common.remove')}
                      onClick={() => removeComponent(i)}
                    >
                      <LuX />
                    </IconButton>
                  )}
                </Flex>
              ))}
            </Stack>
          </Box>

          <Button
            size="sm"
            variant="outline"
            onClick={() => { void handleCreate(); }}
            disabled={!formSymbol || !formName || formComponents.some((c) => !c.symbol) || createCustomSymbol.isPending}
          >
            {t('customSymbols.createIndex')}
          </Button>
        </Stack>
      </Tabs.Content>
      </Tabs.Root>
    </Stack>
  );
});

CustomSymbolsTab.displayName = 'CustomSymbolsTab';
