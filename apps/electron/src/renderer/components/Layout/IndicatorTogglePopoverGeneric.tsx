import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import type { IndicatorCategory, UserIndicator } from '@marketmind/trading-core';
import { INDICATOR_CATALOG } from '@marketmind/trading-core';
import { Checkbox, IconButton, Popover, TooltipWrapper } from '@renderer/components/ui';
import { useIndicatorStore } from '@renderer/store';
import type { IndicatorInstance } from '@renderer/store/indicatorStore';
import { trpc } from '@renderer/utils/trpc';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuGauge } from 'react-icons/lu';
import { useShallow } from 'zustand/shallow';

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

export const IndicatorTogglePopoverGeneric = memo(() => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const { data: userIndicators = [] } = trpc.userIndicators.list.useQuery(undefined, {
    enabled: isOpen,
  });

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

  const groups = useMemo(() => groupByCategory(userIndicators), [userIndicators]);

  const handleToggle = useCallback(
    (ui: UserIndicator, isActive: boolean) => {
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
    [addInstance, removeInstancesByUserIndicatorId],
  );

  const totalCount = userIndicators.length;
  const activeCount = useMemo(() => {
    let count = 0;
    for (const ui of userIndicators) {
      const list = instancesByUserIndicatorId.get(ui.id);
      if (list && list.length > 0) count++;
    }
    return count;
  }, [userIndicators, instancesByUserIndicatorId]);

  return (
    <Popover
      open={isOpen}
      onOpenChange={(e) => setIsOpen(e.open)}
      showArrow={false}
      width="320px"
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
            <Text fontSize="xs" color="fg.muted">
              {activeCount}/{totalCount}
            </Text>
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
                    const matched = instancesByUserIndicatorId.get(ui.id) ?? [];
                    const isActive = matched.length > 0;
                    return (
                      <Checkbox
                        key={ui.id}
                        checked={isActive}
                        onCheckedChange={() => handleToggle(ui, isActive)}
                      >
                        <Text fontSize="sm">{ui.label}</Text>
                      </Checkbox>
                    );
                  })}
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Stack>
      </Box>
    </Popover>
  );
});

IndicatorTogglePopoverGeneric.displayName = 'IndicatorTogglePopoverGeneric';
