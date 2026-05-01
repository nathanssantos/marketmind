import type { DialogControlProps, PositionSide } from '@marketmind/types';
import { VStack } from '@chakra-ui/react';
import type {
  ChecklistCondition,
  ConditionOp,
  IndicatorCategory,
  IndicatorDefinition,
  IndicatorParamValue,
  UserIndicator,
} from '@marketmind/trading-core';
import {
  INDICATORS_BY_CATEGORY,
  INDICATOR_CATALOG,
  getDefaultParamsForType,
} from '@marketmind/trading-core';
import { getDefaultChecklistWeight } from '@marketmind/types';
import type { SelectOption } from '@renderer/components/ui';
import { Field, FormDialog, Input } from '@renderer/components/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChecklistFields } from './fields/ChecklistFields';
import type { ChecklistFieldsValue } from './fields/ChecklistFields';
import { ParamFields } from './fields/ParamFields';
import { SelectField } from './fields/SelectField';

export type IndicatorConfigMode = 'create' | 'edit' | 'checklist-condition';

type ParamRecord = Record<string, IndicatorParamValue>;

export interface IndicatorConfigCreateResult {
  mode: 'create';
  catalogType: string;
  label: string;
  params: ParamRecord;
}

export interface IndicatorConfigEditResult {
  mode: 'edit';
  id: string;
  label: string;
  params: ParamRecord;
}

export interface IndicatorConfigChecklistResult {
  mode: 'checklist-condition';
  userIndicatorId: string;
  timeframe: string;
  op: ConditionOp;
  threshold?: [number, number] | number;
  tier: 'required' | 'preferred';
  side: PositionSide | 'BOTH';
  weight: number;
}

export type IndicatorConfigResult =
  | IndicatorConfigCreateResult
  | IndicatorConfigEditResult
  | IndicatorConfigChecklistResult;

const EMPTY_INDICATORS: UserIndicator[] = [];

export interface IndicatorConfigDialogProps extends DialogControlProps {
  mode: IndicatorConfigMode;
  instance?: UserIndicator;
  availableIndicators?: UserIndicator[];
  initialCondition?: Partial<ChecklistCondition>;
  categoryFilter?: IndicatorCategory;
  isLoading?: boolean;
  onSubmit: (result: IndicatorConfigResult) => void;
}

const labelFor = (def: IndicatorDefinition, params: ParamRecord): string => {
  try {
    return def.defaultLabel(params);
  } catch {
    return def.type.toUpperCase();
  }
};

export const IndicatorConfigDialog = ({
  isOpen,
  onClose,
  mode,
  instance,
  availableIndicators = EMPTY_INDICATORS,
  initialCondition,
  categoryFilter,
  isLoading = false,
  onSubmit,
}: IndicatorConfigDialogProps) => {
  const { t } = useTranslation();

  const catalogEntries = useMemo(
    () =>
      categoryFilter
        ? INDICATORS_BY_CATEGORY[categoryFilter] ?? []
        : Object.values(INDICATOR_CATALOG),
    [categoryFilter],
  );

  const catalogOptions: SelectOption[] = useMemo(
    () =>
      catalogEntries.map((def) => ({
        value: def.type,
        label: t(def.labelKey, { defaultValue: def.type }),
      })),
    [catalogEntries, t],
  );

  const [catalogType, setCatalogType] = useState<string>(
    instance?.catalogType ?? catalogEntries[0]?.type ?? 'ema',
  );
  const [label, setLabel] = useState<string>(instance?.label ?? '');
  const [params, setParams] = useState<ParamRecord>(
    instance?.params ?? getDefaultParamsForType(catalogType),
  );
  const [labelEdited, setLabelEdited] = useState<boolean>(mode === 'edit');

  const [userIndicatorId, setUserIndicatorId] = useState<string>(
    initialCondition?.userIndicatorId ?? availableIndicators[0]?.id ?? '',
  );
  const [condition, setCondition] = useState<ChecklistFieldsValue>({
    timeframe: initialCondition?.timeframe ?? 'current',
    op: initialCondition?.op ?? 'gt',
    threshold: initialCondition?.threshold,
    tier: initialCondition?.tier ?? 'required',
    side: initialCondition?.side ?? 'BOTH',
    weight:
      typeof initialCondition?.weight === 'number' && initialCondition.weight > 0
        ? initialCondition.weight
        : getDefaultChecklistWeight(initialCondition?.timeframe ?? 'current'),
  });

  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'create') {
      const firstType = catalogEntries[0]?.type ?? 'ema';
      setCatalogType(firstType);
      const defaults = getDefaultParamsForType(firstType);
      setParams(defaults);
      const def = INDICATOR_CATALOG[firstType];
      setLabel(def ? labelFor(def, defaults) : firstType.toUpperCase());
      setLabelEdited(false);
      return;
    }

    if (mode === 'edit' && instance) {
      setCatalogType(instance.catalogType);
      setParams(instance.params);
      setLabel(instance.label);
      setLabelEdited(true);
      return;
    }

    if (mode === 'checklist-condition') {
      setUserIndicatorId(initialCondition?.userIndicatorId ?? availableIndicators[0]?.id ?? '');
      const initialTimeframe = initialCondition?.timeframe ?? 'current';
      setCondition({
        timeframe: initialTimeframe,
        op: initialCondition?.op ?? 'gt',
        threshold: initialCondition?.threshold,
        tier: initialCondition?.tier ?? 'required',
        side: initialCondition?.side ?? 'BOTH',
        weight:
          typeof initialCondition?.weight === 'number' && initialCondition.weight > 0
            ? initialCondition.weight
            : getDefaultChecklistWeight(initialTimeframe),
      });
    }
  }, [isOpen, mode, instance, initialCondition, availableIndicators, catalogEntries]);

  const selectedDefinition: IndicatorDefinition | undefined = useMemo(() => {
    if (mode === 'checklist-condition') {
      const pickedIndicator = availableIndicators.find((i) => i.id === userIndicatorId);
      return pickedIndicator ? INDICATOR_CATALOG[pickedIndicator.catalogType] : undefined;
    }
    return INDICATOR_CATALOG[catalogType];
  }, [mode, catalogType, userIndicatorId, availableIndicators]);

  const handleCatalogChange = (next: string) => {
    setCatalogType(next);
    const defaults = getDefaultParamsForType(next);
    setParams(defaults);
    const def = INDICATOR_CATALOG[next];
    if (!labelEdited && def) setLabel(labelFor(def, defaults));
  };

  const handleParamChange = (key: string, value: IndicatorParamValue) => {
    setParams((prev) => {
      const next = { ...prev, [key]: value };
      if (!labelEdited && selectedDefinition) {
        setLabel(labelFor(selectedDefinition, next));
      }
      return next;
    });
  };

  const handleLabelChange = (next: string) => {
    setLabel(next);
    setLabelEdited(true);
  };

  const title = useMemo(() => {
    if (mode === 'create') return t('indicators.dialog.createTitle');
    if (mode === 'edit') return t('indicators.dialog.editTitle');
    return t('indicators.dialog.conditionTitle');
  }, [mode, t]);

  const submitDisabled = useMemo(() => {
    if (mode === 'create' || mode === 'edit') return label.trim().length === 0;
    if (mode === 'checklist-condition') return !userIndicatorId;
    return false;
  }, [mode, label, userIndicatorId]);

  const handleSubmit = () => {
    if (mode === 'create') {
      onSubmit({ mode: 'create', catalogType, label: label.trim(), params });
      return;
    }
    if (mode === 'edit' && instance) {
      onSubmit({ mode: 'edit', id: instance.id, label: label.trim(), params });
      return;
    }
    if (mode === 'checklist-condition') {
      onSubmit({
        mode: 'checklist-condition',
        userIndicatorId,
        timeframe: condition.timeframe,
        op: condition.op,
        threshold: condition.threshold,
        tier: condition.tier,
        side: condition.side,
        weight: condition.weight,
      });
    }
  };

  const indicatorOptions: SelectOption[] = availableIndicators.map((i) => ({
    value: i.id,
    label: i.label,
  }));

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      submitDisabled={submitDisabled}
      size="md"
    >
      <VStack gap={4} align="stretch">
        {mode === 'create' && (
          <SelectField
            label={t('indicators.dialog.type')}
            value={catalogType}
            options={catalogOptions}
            onChange={handleCatalogChange}
          />
        )}

        {mode === 'checklist-condition' && (
          <SelectField
            label={t('indicators.dialog.indicator')}
            value={userIndicatorId}
            options={indicatorOptions}
            onChange={setUserIndicatorId}
          />
        )}

        {(mode === 'create' || mode === 'edit') && (
          <Field label={t('indicators.dialog.label')}>
            <Input
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder={t('indicators.dialog.labelPlaceholder')}
              size="sm"
            />
          </Field>
        )}

        {(mode === 'create' || mode === 'edit') && selectedDefinition && (
          <ParamFields
            params={selectedDefinition.params}
            values={params}
            onChange={handleParamChange}
          />
        )}

        {mode === 'checklist-condition' && selectedDefinition && (
          <ChecklistFields
            value={condition}
            availableOps={selectedDefinition.conditionOps}
            onChange={setCondition}
          />
        )}
      </VStack>
    </FormDialog>
  );
};
