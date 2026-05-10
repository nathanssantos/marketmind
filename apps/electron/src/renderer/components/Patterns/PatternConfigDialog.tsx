import { Box, Flex, HStack, Stack, Text, Textarea, VStack } from '@chakra-ui/react';
import {
  PatternParseError,
  compilePattern,
  detectPatterns,
  parsePatternExpression,
  type PatternCategory,
  type PatternDefinition,
  type PatternParamDef,
  type PatternSentiment,
} from '@marketmind/trading-core';
import type { Kline } from '@marketmind/types';
import {
  Button,
  Field,
  FormDialog,
  IconButton,
  Input,
  NumberInput,
  Select,
  type SelectOption,
} from '@renderer/components/ui';
import type { UserPattern } from '@renderer/hooks/useUserPatterns';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPlus, LuTrash2 } from 'react-icons/lu';

type Mode = 'create' | 'edit';

const CATEGORIES: SelectOption[] = [
  { value: 'reversal-single', label: 'Reversal — single bar' },
  { value: 'reversal-multi', label: 'Reversal — multi bar' },
  { value: 'continuation', label: 'Continuation' },
  { value: 'indecision', label: 'Indecision' },
];

const SENTIMENTS: SelectOption[] = [
  { value: 'bullish', label: 'Bullish' },
  { value: 'bearish', label: 'Bearish' },
  { value: 'neutral', label: 'Neutral' },
];

const BARS_OPTIONS: SelectOption[] = [
  { value: '1', label: '1 bar' },
  { value: '2', label: '2 bars' },
  { value: '3', label: '3 bars' },
  { value: '4', label: '4 bars' },
  { value: '5', label: '5 bars' },
];

interface FormState {
  id: string;
  label: string;
  category: PatternCategory;
  sentiment: PatternSentiment;
  bars: 1 | 2 | 3 | 4 | 5;
  params: PatternParamDef[];
  constraints: string[];
  description: string;
}

const slugify = (s: string): string =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'custom-pattern';

const emptyForm = (): FormState => ({
  id: '',
  label: '',
  category: 'reversal-single',
  sentiment: 'bullish',
  bars: 1,
  params: [],
  constraints: ['body(b0) > 0'],
  description: '',
});

const fromDefinition = (def: PatternDefinition): FormState => ({
  id: def.id,
  label: def.label,
  category: def.category,
  sentiment: def.sentiment,
  bars: def.bars,
  params: def.params.map((p) => ({ ...p })),
  constraints: [...def.constraints],
  description: def.description ?? '',
});

const buildDefinition = (form: FormState): PatternDefinition => ({
  id: form.id || slugify(form.label),
  label: form.label.trim() || 'Untitled Pattern',
  category: form.category,
  sentiment: form.sentiment,
  bars: form.bars,
  params: form.params.map((p) => ({ ...p })),
  constraints: form.constraints.map((c) => c.trim()).filter((c) => c.length > 0),
  ...(form.description.trim() ? { description: form.description.trim() } : {}),
});

export interface PatternConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mode: Mode;
  /** Required in edit mode, ignored otherwise. */
  pattern?: UserPattern;
  isLoading?: boolean;
  onSubmit: (definition: PatternDefinition) => void;
  /**
   * When provided, the dialog renders a small preview strip below the form
   * showing how many bars in this kline window match the current draft
   * definition. Helps users tune constraints before saving.
   */
  previewKlines?: readonly Kline[];
}

const PREVIEW_BAR_COUNT = 200;

/**
 * Create / edit dialog for candle-pattern definitions. Mirrors the indicator
 * config dialog UX but the form is purely DSL-driven — params are pure
 * tunables, constraints are expression strings parsed live by the same
 * `parsePatternExpression` the runtime uses (so what validates here will
 * validate at evaluation time too).
 */
export const PatternConfigDialog = ({
  isOpen,
  onClose,
  mode,
  pattern,
  isLoading = false,
  onSubmit,
  previewKlines,
}: PatternConfigDialogProps): ReactElement => {
  const { t } = useTranslation();

  const initial = useMemo<FormState>(
    () => (mode === 'edit' && pattern ? fromDefinition(pattern.definition) : emptyForm()),
    [mode, pattern],
  );

  const [form, setForm] = useState<FormState>(initial);
  const [constraintErrors, setConstraintErrors] = useState<(string | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setForm(initial);
      setConstraintErrors(initial.constraints.map(() => null));
    }
  }, [isOpen, initial]);

  const validateConstraint = (raw: string): string | null => {
    const expr = raw.trim();
    if (!expr) return 'Required';
    try { parsePatternExpression(expr); return null; }
    catch (err) { return err instanceof PatternParseError ? err.message : 'Invalid expression'; }
  };

  const setConstraint = (i: number, value: string): void => {
    setForm((prev) => {
      const constraints = [...prev.constraints];
      constraints[i] = value;
      return { ...prev, constraints };
    });
    setConstraintErrors((prev) => {
      const next = [...prev];
      next[i] = validateConstraint(value);
      return next;
    });
  };

  const addConstraint = (): void => {
    setForm((p) => ({ ...p, constraints: [...p.constraints, ''] }));
    setConstraintErrors((p) => [...p, 'Required']);
  };

  const removeConstraint = (i: number): void => {
    setForm((p) => ({ ...p, constraints: p.constraints.filter((_, idx) => idx !== i) }));
    setConstraintErrors((p) => p.filter((_, idx) => idx !== i));
  };

  const setParam = (i: number, patch: Partial<PatternParamDef>): void => {
    setForm((p) => {
      const params = [...p.params];
      params[i] = { ...params[i]!, ...patch };
      return { ...p, params };
    });
  };

  const addParam = (): void => {
    setForm((p) => ({
      ...p,
      params: [...p.params, { key: `p${p.params.length + 1}`, label: 'New parameter', type: 'number', default: 1 }],
    }));
  };

  const removeParam = (i: number): void => {
    setForm((p) => ({ ...p, params: p.params.filter((_, idx) => idx !== i) }));
  };

  const hasConstraintErrors = constraintErrors.some((e) => e !== null);
  const hasLabel = form.label.trim().length > 0;
  const submitDisabled = !hasLabel || hasConstraintErrors || form.constraints.length === 0;

  // Live preview — runs detection against the last ~200 bars of the supplied
  // klines using the in-flight definition. Skips when the definition has
  // any constraint parse error.
  const previewMatchCount = useMemo<number | null>(() => {
    if (!previewKlines || previewKlines.length < 2 || hasConstraintErrors) return null;
    if (form.constraints.every((c) => c.trim().length === 0)) return null;
    try {
      const def = buildDefinition(form);
      const compiled = compilePattern(def);
      const slice = previewKlines.slice(-PREVIEW_BAR_COUNT);
      const hits = detectPatterns([...slice], [compiled]);
      return hits.length;
    } catch {
      return null;
    }
  }, [previewKlines, form, hasConstraintErrors]);

  const handleSubmit = (): void => {
    if (submitDisabled) return;
    onSubmit(buildDefinition(form));
  };

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? t('chart.patterns.edit', { defaultValue: 'Edit pattern' }) : t('chart.patterns.create', { defaultValue: 'New pattern' })}
      size="lg"
      onSubmit={handleSubmit}
      submitDisabled={submitDisabled}
      isLoading={isLoading}
      submitLabel={mode === 'edit' ? t('common.save', { defaultValue: 'Save' }) : t('common.create', { defaultValue: 'Create' })}
    >
      <VStack align="stretch" gap={4}>
        <Stack gap={3}>
          <Text fontSize="sm" fontWeight="semibold">{t('chart.patterns.dialog.identity', { defaultValue: 'Identity' })}</Text>
          <Field label={t('chart.patterns.dialog.label', { defaultValue: 'Label' })} required>
            <Input
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
              placeholder="My Custom Pattern"
            />
          </Field>
          <HStack gap={3} align="flex-start">
            <Field label={t('chart.patterns.dialog.category', { defaultValue: 'Category' })}>
              <Select
                value={form.category}
                onChange={(v) => setForm((p) => ({ ...p, category: v as PatternCategory }))}
                options={CATEGORIES}
              />
            </Field>
            <Field label={t('chart.patterns.dialog.sentiment', { defaultValue: 'Sentiment' })}>
              <Select
                value={form.sentiment}
                onChange={(v) => setForm((p) => ({ ...p, sentiment: v as PatternSentiment }))}
                options={SENTIMENTS}
              />
            </Field>
            <Field label={t('chart.patterns.dialog.bars', { defaultValue: 'Bars' })}>
              <Select
                value={String(form.bars)}
                onChange={(v) => setForm((p) => ({ ...p, bars: (Number(v) as 1 | 2 | 3 | 4 | 5) }))}
                options={BARS_OPTIONS}
              />
            </Field>
          </HStack>
          <Field label={t('chart.patterns.dialog.description', { defaultValue: 'Description (optional)' })}>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder="Bullish reversal at support — long lower wick, small body near the top."
            />
          </Field>
        </Stack>

        <Stack gap={2}>
          <Flex justify="space-between" align="center">
            <Text fontSize="sm" fontWeight="semibold">{t('chart.patterns.dialog.params', { defaultValue: 'Parameters' })}</Text>
            <Button size="2xs" variant="outline" onClick={addParam}>
              <LuPlus />
              {t('chart.patterns.dialog.addParam', { defaultValue: 'Add parameter' })}
            </Button>
          </Flex>
          {form.params.length === 0 ? (
            <Text fontSize="xs" color="fg.muted">
              {t('chart.patterns.dialog.paramsEmpty', { defaultValue: 'No parameters. Add one to expose a tunable in the popover.' })}
            </Text>
          ) : (
            form.params.map((p, i) => (
              <HStack key={i} gap={2} align="flex-start">
                <Field label={t('chart.patterns.dialog.paramKey', { defaultValue: 'Key' })}>
                  <Input value={p.key} onChange={(e) => setParam(i, { key: e.target.value })} placeholder="wickRatio" />
                </Field>
                <Field label={t('chart.patterns.dialog.paramLabel', { defaultValue: 'Label' })}>
                  <Input value={p.label} onChange={(e) => setParam(i, { label: e.target.value })} placeholder="Min lower wick / body" />
                </Field>
                <Field label={t('chart.patterns.dialog.paramDefault', { defaultValue: 'Default' })}>
                  <NumberInput
                    value={String(p.default)}
                    onChange={(e) => setParam(i, { default: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Box pt={6}>
                  <IconButton aria-label="Remove parameter" size="2xs" variant="ghost" colorPalette="red" onClick={() => removeParam(i)}>
                    <LuTrash2 />
                  </IconButton>
                </Box>
              </HStack>
            ))
          )}
        </Stack>

        <Stack gap={2}>
          <Flex justify="space-between" align="center">
            <Text fontSize="sm" fontWeight="semibold">{t('chart.patterns.dialog.constraints', { defaultValue: 'Constraints' })}</Text>
            <Button size="2xs" variant="outline" onClick={addConstraint}>
              <LuPlus />
              {t('chart.patterns.dialog.addConstraint', { defaultValue: 'Add constraint' })}
            </Button>
          </Flex>
          <Text fontSize="xs" color="fg.muted">
            {t('chart.patterns.dialog.constraintsHint', { defaultValue: 'All constraints AND-ed. Reference bars as b0 (newest), b1, b2, … and parameters as params.<key>. Available: open / high / low / close / volume / body / range / upperWick / lowerWick / topBody / bottomBody / midBody / direction.' })}
          </Text>
          {previewKlines && previewKlines.length >= 2 ? (
            <Box bg="bg.muted" borderRadius="sm" px={2} py={1}>
              <Text fontSize="2xs" color="fg.muted">
                {previewMatchCount === null
                  ? t('chart.patterns.dialog.previewInvalid', { defaultValue: 'Preview unavailable — fix the errors above to see matches.' })
                  : t('chart.patterns.dialog.previewMatches', {
                      defaultValue: 'Matches in last {{n}} bars: {{count}}',
                      n: Math.min(previewKlines.length, PREVIEW_BAR_COUNT),
                      count: previewMatchCount,
                    })}
              </Text>
            </Box>
          ) : null}
          {form.constraints.map((c, i) => (
            <Stack key={i} gap={1}>
              <HStack gap={2} align="flex-start">
                <Box flex={1}>
                  <Textarea
                    value={c}
                    onChange={(e) => setConstraint(i, e.target.value)}
                    rows={1}
                    fontFamily="mono"
                    fontSize="xs"
                    resize="vertical"
                    placeholder="lowerWick(b0) >= params.wickRatio * body(b0)"
                  />
                </Box>
                <Box pt={1}>
                  <IconButton aria-label="Remove constraint" size="2xs" variant="ghost" colorPalette="red" onClick={() => removeConstraint(i)}>
                    <LuTrash2 />
                  </IconButton>
                </Box>
              </HStack>
              {constraintErrors[i] ? (
                <Text fontSize="2xs" color="trading.loss" pl={2}>
                  {constraintErrors[i]}
                </Text>
              ) : null}
            </Stack>
          ))}
        </Stack>
      </VStack>
    </FormDialog>
  );
};
