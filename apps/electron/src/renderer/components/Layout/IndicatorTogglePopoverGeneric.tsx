import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import type { IndicatorCategory, UserIndicator } from '@marketmind/trading-core';
import { INDICATOR_CATALOG } from '@marketmind/trading-core';
import {
  Button,
  Checkbox,
  ConfirmationDialog,
  IconButton,
  Popover,
  TooltipWrapper,
} from '@renderer/components/ui';
import { useUserIndicators } from '@renderer/hooks';
import { useIndicatorStore } from '@renderer/store';
import type { IndicatorInstance } from '@renderer/store/indicatorStore';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuGauge, LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';
import { useShallow } from 'zustand/shallow';
import {
  IndicatorConfigDialog,
  type IndicatorConfigResult,
} from '../Indicators/IndicatorConfigDialog';

export interface CategoryGroup {
  category: IndicatorCategory;
  titleKey: string;
  items: UserIndicator[];
}

export const CATEGORY_ORDER: IndicatorCategory[] = [
  'oscillators',
  'momentum',
  'trend',
  'volatility',
  'volume',
  'movingAverages',
  'priceStructure',
  'orderFlow',
];

export const groupByCategory = (indicators: UserIndicator[]): CategoryGroup[] => {
  const map = new Map<IndicatorCategory, UserIndicator[]>();
  for (const ui of indicators) {
    const def = INDICATOR_CATALOG[ui.catalogType];
    if (!def) continue;
    const list = map.get(def.category) ?? [];
    list.push(ui);
    map.set(def.category, list);
  }
  const groups: CategoryGroup[] = [];
  for (const category of CATEGORY_ORDER) {
    const items = map.get(category);
    if (!items?.length) continue;
    groups.push({
      category,
      titleKey: `chart.indicators.categories.${category}`,
      items,
    });
  }
  return groups;
};

type DialogState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; indicator: UserIndicator };

export interface IndicatorTogglePopoverGenericProps {
  activeUserIndicatorIdsOverride?: string[];
  onToggleUserIndicatorOverride?: (userIndicatorId: string) => void;
}

export const IndicatorTogglePopoverGeneric = memo(
  ({
    activeUserIndicatorIdsOverride,
    onToggleUserIndicatorOverride,
  }: IndicatorTogglePopoverGenericProps = {}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
  const [confirmDelete, setConfirmDelete] = useState<UserIndicator | null>(null);
  const isOverrideMode = activeUserIndicatorIdsOverride !== undefined && onToggleUserIndicatorOverride !== undefined;

  const { indicators, create, update, remove } = useUserIndicators();

  const { instances, addInstance, removeInstancesByUserIndicatorId } = useIndicatorStore(
    useShallow((s) => ({
      instances: s.instances,
      addInstance: s.addInstance,
      removeInstancesByUserIndicatorId: s.removeInstancesByUserIndicatorId,
    })),
  );

  const instancesByUserIndicatorId = useMemo(() => {
    const map = new Map<string, IndicatorInstance[]>();
    for (const inst of instances) {
      const list = map.get(inst.userIndicatorId) ?? [];
      list.push(inst);
      map.set(inst.userIndicatorId, list);
    }
    return map;
  }, [instances]);

  const overrideActiveSet = useMemo(
    () => (activeUserIndicatorIdsOverride ? new Set(activeUserIndicatorIdsOverride) : null),
    [activeUserIndicatorIdsOverride],
  );

  const isUserIndicatorActive = useCallback(
    (ui: UserIndicator): boolean => {
      if (overrideActiveSet) return overrideActiveSet.has(ui.id);
      const matched = instancesByUserIndicatorId.get(ui.id);
      return !!matched && matched.length > 0;
    },
    [overrideActiveSet, instancesByUserIndicatorId],
  );

  const groups = useMemo(() => groupByCategory(indicators), [indicators]);

  const handleToggle = useCallback(
    (ui: UserIndicator, isActive: boolean) => {
      if (isOverrideMode) {
        onToggleUserIndicatorOverride!(ui.id);
        return;
      }
      if (isActive) {
        removeInstancesByUserIndicatorId(ui.id);
        return;
      }
      addInstance({
        userIndicatorId: ui.id,
        catalogType: ui.catalogType,
        params: ui.params,
        visible: true,
      });
    },
    [addInstance, removeInstancesByUserIndicatorId, isOverrideMode, onToggleUserIndicatorOverride],
  );

  const handleSubmit = useCallback(
    async (result: IndicatorConfigResult) => {
      if (result.mode === 'create') {
        await create.mutateAsync({
          catalogType: result.catalogType,
          label: result.label,
          params: result.params,
        });
      } else if (result.mode === 'edit') {
        await update.mutateAsync({ id: result.id, label: result.label, params: result.params });
      }
      setDialog({ kind: 'closed' });
    },
    [create, update],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDelete) return;
    removeInstancesByUserIndicatorId(confirmDelete.id);
    await remove.mutateAsync({ id: confirmDelete.id });
    setConfirmDelete(null);
  }, [confirmDelete, remove, removeInstancesByUserIndicatorId]);

  const totalCount = indicators.length;
  const activeCount = useMemo(() => {
    let count = 0;
    for (const ui of indicators) if (isUserIndicatorActive(ui)) count++;
    return count;
  }, [indicators, isUserIndicatorActive]);

  return (
    <>
      <Popover
        open={isOpen}
        onOpenChange={(e) => setIsOpen(e.open)}
        showArrow={false}
        width="360px"
        positioning={{ placement: 'right-start', offset: { mainAxis: 8 } }}
        trigger={
          <Flex>
            <TooltipWrapper
              label={t('chart.indicators.configure')}
              showArrow
              placement="right"
              isDisabled={isOpen}
            >
              <IconButton
                aria-label={t('chart.indicators.configure')}
                size="2xs"
                variant="outline"
                color="fg.muted"
              >
                <LuGauge />
              </IconButton>
            </TooltipWrapper>
          </Flex>
        }
      >
        <Box p={4} maxH="600px" overflowY="auto">
          <Stack gap={4}>
            <Flex justify="space-between" align="center">
              <Text fontSize="sm" fontWeight="bold">
                {t('chart.indicators.title')}
              </Text>
              <HStack gap={2}>
                <Text fontSize="xs" color="fg.muted">
                  {activeCount}/{totalCount}
                </Text>
                <Button
                  size="2xs"
                  colorPalette="blue"
                  onClick={() => setDialog({ kind: 'create' })}
                >
                  <LuPlus />
                  {t('settings.indicators.new')}
                </Button>
              </HStack>
            </Flex>

            <Stack gap={4} maxH="500px" overflowY="auto">
              {groups.map((group) => (
                <Stack key={group.category} gap={2}>
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    color="fg.muted"
                    textTransform="uppercase"
                    letterSpacing="wide"
                  >
                    {t(group.titleKey)}
                  </Text>
                  <Stack gap={1.5} pl={2}>
                    {group.items.map((ui) => {
                      const isActive = isUserIndicatorActive(ui);
                      return (
                        <Flex key={ui.id} align="center" justify="space-between" gap={2}>
                          <Box flex={1} minW={0}>
                            <Checkbox
                              checked={isActive}
                              onCheckedChange={() => handleToggle(ui, isActive)}
                            >
                              <Text fontSize="sm" truncate>
                                {ui.label}
                              </Text>
                            </Checkbox>
                          </Box>
                          <HStack gap={0.5}>
                            <TooltipWrapper label={t('common.edit')}>
                              <IconButton
                                aria-label={t('common.edit')}
                                size="2xs"
                                variant="ghost"
                                onClick={() => setDialog({ kind: 'edit', indicator: ui })}
                              >
                                <LuPencil />
                              </IconButton>
                            </TooltipWrapper>
                            <TooltipWrapper label={t('common.delete')}>
                              <IconButton
                                aria-label={t('common.delete')}
                                size="2xs"
                                variant="ghost"
                                colorPalette="red"
                                onClick={() => setConfirmDelete(ui)}
                              >
                                <LuTrash2 />
                              </IconButton>
                            </TooltipWrapper>
                          </HStack>
                        </Flex>
                      );
                    })}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Box>
      </Popover>

      <IndicatorConfigDialog
        isOpen={dialog.kind !== 'closed'}
        onClose={() => setDialog({ kind: 'closed' })}
        mode={dialog.kind === 'edit' ? 'edit' : 'create'}
        instance={dialog.kind === 'edit' ? dialog.indicator : undefined}
        isLoading={create.isPending || update.isPending}
        onSubmit={handleSubmit}
      />

      <ConfirmationDialog
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
        title={t('settings.indicators.deleteTitle')}
        description={t('settings.indicators.deleteDescription', { label: confirmDelete?.label ?? '' })}
        isDestructive
        isLoading={remove.isPending}
      />
    </>
  );
  },
);

IndicatorTogglePopoverGeneric.displayName = 'IndicatorTogglePopoverGeneric';
