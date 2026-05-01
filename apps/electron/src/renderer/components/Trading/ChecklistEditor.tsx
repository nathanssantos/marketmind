import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import type { ChecklistCondition, UserIndicator } from '@marketmind/trading-core';
import { INDICATOR_CATALOG } from '@marketmind/trading-core';
import type { ChecklistConditionDto } from '@marketmind/types';
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  Switch,
  TooltipWrapper,
} from '@renderer/components/ui';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp, LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';
import { IndicatorConfigDialog } from '../Indicators/IndicatorConfigDialog';
import type { IndicatorConfigResult } from '../Indicators/IndicatorConfigDialog';

const generateConditionId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export interface ChecklistEditorProps {
  conditions: ChecklistConditionDto[];
  availableIndicators: UserIndicator[];
  onChange: (next: ChecklistConditionDto[]) => void;
  isSaving?: boolean;
}

interface EditorState {
  mode: 'create' | 'edit';
  conditionId?: string;
  initialCondition?: Partial<ChecklistCondition>;
}

const sortByOrder = (a: ChecklistConditionDto, b: ChecklistConditionDto): number => a.order - b.order;

const thresholdLabel = (threshold: ChecklistConditionDto['threshold']): string => {
  if (threshold === undefined) return '';
  if (Array.isArray(threshold)) return `[${threshold[0]}, ${threshold[1]}]`;
  return String(threshold);
};

const sideColor = (side: ChecklistConditionDto['side']): 'green' | 'red' | 'gray' => {
  if (side === 'LONG') return 'green';
  if (side === 'SHORT') return 'red';
  return 'gray';
};

export const ChecklistEditor = ({
  conditions,
  availableIndicators,
  onChange,
  isSaving,
}: ChecklistEditorProps) => {
  const { t } = useTranslation();
  const [editorState, setEditorState] = useState<EditorState | null>(null);

  const sorted = useMemo(() => [...conditions].sort(sortByOrder), [conditions]);

  const indicatorMap = useMemo(() => {
    const map = new Map<string, UserIndicator>();
    for (const ind of availableIndicators) map.set(ind.id, ind);
    return map;
  }, [availableIndicators]);

  const commit = useCallback(
    (next: ChecklistConditionDto[]) => {
      const normalized = next.map((c, idx) => ({ ...c, order: idx }));
      onChange(normalized);
    },
    [onChange],
  );

  const handleToggleEnabled = (id: string, enabled: boolean) => {
    commit(sorted.map((c) => (c.id === id ? { ...c, enabled } : c)));
  };

  const handleDelete = (id: string) => {
    commit(sorted.filter((c) => c.id !== id));
  };

  const handleMove = (id: string, direction: -1 | 1) => {
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const next = [...sorted];
    const a = next[idx]!;
    const b = next[swapIdx]!;
    next[idx] = b;
    next[swapIdx] = a;
    commit(next);
  };

  const handleAdd = () => {
    setEditorState({ mode: 'create' });
  };

  const handleEdit = (id: string) => {
    const cond = conditions.find((c) => c.id === id);
    if (!cond) return;
    setEditorState({
      mode: 'edit',
      conditionId: id,
      initialCondition: {
        userIndicatorId: cond.userIndicatorId,
        timeframe: cond.timeframe,
        op: cond.op,
        threshold: cond.threshold,
        tier: cond.tier,
        side: cond.side,
        weight: cond.weight,
      },
    });
  };

  const handleDialogSubmit = (result: IndicatorConfigResult) => {
    if (result.mode !== 'checklist-condition') return;

    if (editorState?.mode === 'edit' && editorState.conditionId) {
      commit(
        sorted.map((c) =>
          c.id === editorState.conditionId
            ? {
                ...c,
                userIndicatorId: result.userIndicatorId,
                timeframe: result.timeframe,
                op: result.op,
                threshold: result.threshold,
                tier: result.tier,
                side: result.side,
                weight: result.weight,
              }
            : c,
        ),
      );
    } else {
      const newCondition: ChecklistConditionDto = {
        id: generateConditionId(),
        userIndicatorId: result.userIndicatorId,
        timeframe: result.timeframe,
        op: result.op,
        threshold: result.threshold,
        tier: result.tier,
        side: result.side,
        weight: result.weight,
        enabled: true,
        order: sorted.length,
      };
      commit([...sorted, newCondition]);
    }

    setEditorState(null);
  };

  return (
    <Stack gap={2}>
      <Flex justify="flex-end" align="center">
        <Button
          size="2xs"
          variant="outline"
          onClick={handleAdd}
          disabled={availableIndicators.length === 0}
        >
          <LuPlus />
          {t('checklist.editor.add')}
        </Button>
      </Flex>

      {sorted.length === 0 ? (
        <EmptyState
          title={t('checklist.editor.emptyTitle')}
          description={t('checklist.editor.emptyDescription')}
        />
      ) : (
        <Stack gap={2}>
          {sorted.map((cond, idx) => {
            const indicator = indicatorMap.get(cond.userIndicatorId);
            const catalogDef = indicator ? INDICATOR_CATALOG[indicator.catalogType] : undefined;
            const label = indicator?.label ?? t('checklist.editor.missing');
            const opLabel = t(`checklist.ops.${cond.op}`, { defaultValue: cond.op });
            const tfLabel = t(`checklist.timeframes.${cond.timeframe}`, { defaultValue: cond.timeframe });

            return (
              <Box
                key={cond.id}
                p={2}
                bg="bg.muted"
                borderRadius="md"
                borderLeft="3px solid"
                borderColor={cond.tier === 'required' ? 'trading.warning' : 'trading.info'}
                opacity={cond.enabled ? 1 : 0.5}
              >
                <Flex justify="space-between" align="center" gap={2}>
                  <Stack gap={1} flex={1} minW={0}>
                    <HStack gap={2} flexWrap="wrap">
                      <Text fontSize="sm" fontWeight="semibold" truncate>
                        {label}
                      </Text>
                      <Badge size="sm" colorPalette={cond.tier === 'required' ? 'orange' : 'blue'}>
                        {t(`checklist.tier.${cond.tier}Short`, {
                          defaultValue: cond.tier === 'required' ? 'req' : 'pref',
                        })}
                      </Badge>
                      <Badge size="sm" colorPalette={sideColor(cond.side)}>
                        {t(`checklist.side.${cond.side.toLowerCase()}`, { defaultValue: cond.side })}
                      </Badge>
                      <Badge size="sm" variant="outline">
                        {tfLabel}
                      </Badge>
                      <Badge size="sm" variant="subtle" colorPalette="purple">
                        ×{cond.weight.toFixed(2)}
                      </Badge>
                    </HStack>
                    <Text fontSize="xs" color="fg.muted">
                      {opLabel} {thresholdLabel(cond.threshold)}
                      {!catalogDef && indicator && (
                        <Text as="span" ml={2} color="red.fg">
                          {t('checklist.editor.unknownCatalog')}
                        </Text>
                      )}
                    </Text>
                  </Stack>

                  <HStack gap={1}>
                    <Switch
                      checked={cond.enabled}
                      onCheckedChange={(v) => handleToggleEnabled(cond.id, Boolean(v))}
                      size="sm"
                    />
                    <TooltipWrapper
                      label={t('checklist.editor.moveUp')}
                      showArrow
                    >
                      <IconButton
                        size="2xs"
                        variant="ghost"
                        aria-label={t('checklist.editor.moveUp')}
                        onClick={() => handleMove(cond.id, -1)}
                        disabled={idx === 0 || isSaving}
                      >
                        <LuChevronUp />
                      </IconButton>
                    </TooltipWrapper>
                    <TooltipWrapper
                      label={t('checklist.editor.moveDown')}
                      showArrow
                    >
                      <IconButton
                        size="2xs"
                        variant="ghost"
                        aria-label={t('checklist.editor.moveDown')}
                        onClick={() => handleMove(cond.id, 1)}
                        disabled={idx === sorted.length - 1 || isSaving}
                      >
                        <LuChevronDown />
                      </IconButton>
                    </TooltipWrapper>
                    <IconButton
                      size="2xs"
                      variant="ghost"
                      aria-label={t('common.edit')}
                      onClick={() => handleEdit(cond.id)}
                      disabled={isSaving}
                    >
                      <LuPencil />
                    </IconButton>
                    <IconButton
                      size="2xs"
                      variant="ghost"
                      colorPalette="red"
                      aria-label={t('common.delete')}
                      onClick={() => handleDelete(cond.id)}
                      disabled={isSaving}
                    >
                      <LuTrash2 />
                    </IconButton>
                  </HStack>
                </Flex>
              </Box>
            );
          })}
        </Stack>
      )}

      {editorState && (
        <IndicatorConfigDialog
          isOpen
          onClose={() => setEditorState(null)}
          mode="checklist-condition"
          availableIndicators={availableIndicators}
          initialCondition={editorState.initialCondition}
          onSubmit={handleDialogSubmit}
        />
      )}
    </Stack>
  );
};
