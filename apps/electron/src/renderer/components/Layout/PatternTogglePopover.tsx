import { Flex, HStack, Stack, Text } from '@chakra-ui/react';
import type { PatternCategory } from '@marketmind/trading-core';
import {
  Button,
  IconButton,
  Popover,
  PopoverList,
  PopoverListHeader,
  PopoverSectionLabel,
  PopoverToggleItem,
  TooltipWrapper,
} from '@renderer/components/ui';
import { useUserPatterns, type UserPattern } from '@renderer/hooks/useUserPatterns';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { usePatternStore } from '@renderer/store';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuFlag } from 'react-icons/lu';

const CATEGORY_ORDER: PatternCategory[] = ['reversal-single', 'reversal-multi', 'continuation', 'indecision'];

interface CategoryGroup {
  category: PatternCategory;
  titleKey: string;
  items: UserPattern[];
}

const groupByCategory = (patterns: UserPattern[]): CategoryGroup[] => {
  const map = new Map<PatternCategory, UserPattern[]>();
  for (const p of patterns) {
    const list = map.get(p.definition.category) ?? [];
    list.push(p);
    map.set(p.definition.category, list);
  }
  const groups: CategoryGroup[] = [];
  for (const category of CATEGORY_ORDER) {
    const items = map.get(category);
    if (!items?.length) continue;
    groups.push({
      category,
      titleKey: `chart.patterns.categories.${category}`,
      items,
    });
  }
  return groups;
};

const SENTIMENT_DOT_COLOR: Record<UserPattern['definition']['sentiment'], string> = {
  bullish: 'trading.profit',
  bearish: 'trading.loss',
  neutral: 'fg.muted',
};

export interface PatternTogglePopoverProps {
  triggerVariant?: 'icon' | 'labeled';
  popoverPlacement?: 'right-start' | 'bottom-start';
}

/**
 * Catalog popover for candle patterns. Visual structure mirrors
 * `IndicatorTogglePopoverGeneric` — both could share an extracted
 * `CatalogTogglePopover` shell in a follow-up; for M1 we keep them as
 * separate wrappers around the shared `ui/` primitives (Popover,
 * PopoverList, PopoverToggleItem, etc.). M2 will add the create/edit
 * dialog (currently the popover is read-only / toggle-only).
 *
 * Per-panel scoped: toggling adds/removes the user-pattern id to the
 * focused chart panel only. With no focused panel, toggling is disabled.
 */
export const PatternTogglePopover = memo(({ triggerVariant = 'labeled', popoverPlacement = 'bottom-start' }: PatternTogglePopoverProps = {}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const { patterns, isLoading } = useUserPatterns();

  const focusedPanelId = useLayoutStore((s) => s.focusedPanelId);
  const enabledIds = usePatternStore((s) => (focusedPanelId ? s.enabledIdsByPanelId[focusedPanelId] : undefined));
  const toggleForPanel = usePatternStore((s) => s.toggleForPanel);

  const enabledSet = useMemo(() => new Set(enabledIds ?? []), [enabledIds]);
  const groups = useMemo(() => groupByCategory(patterns), [patterns]);
  const totalCount = patterns.length;
  const activeCount = enabledSet.size;
  const disabled = !focusedPanelId;

  const handleToggle = useCallback(
    (p: UserPattern) => {
      if (!focusedPanelId) return;
      toggleForPanel(focusedPanelId, p.id);
    },
    [focusedPanelId, toggleForPanel],
  );

  return (
    <Popover
      open={isOpen}
      onOpenChange={(e) => setIsOpen(e.open)}
      showArrow={false}
      width="360px"
      positioning={{ placement: popoverPlacement, offset: { mainAxis: 8 } }}
      trigger={
        <Flex>
          <TooltipWrapper
            label={t('chart.patterns.configure')}
            showArrow
            placement={popoverPlacement === 'bottom-start' ? 'bottom' : 'right'}
            isDisabled={isOpen}
          >
            {triggerVariant === 'labeled' ? (
              <Button
                aria-label={t('chart.patterns.configure')}
                size="2xs"
                variant="outline"
                color="fg.muted"
                fontWeight="medium"
                gap={1.5}
              >
                <LuFlag />
                {t('chart.patterns.title')}
              </Button>
            ) : (
              <IconButton
                aria-label={t('chart.patterns.configure')}
                size="2xs"
                variant="outline"
                color="fg.muted"
              >
                <LuFlag />
              </IconButton>
            )}
          </TooltipWrapper>
        </Flex>
      }
    >
      <PopoverList p={2} maxH="600px">
        <PopoverListHeader
          title={t('chart.patterns.title')}
          action={
            <HStack gap={2}>
              <Text fontSize="xs" color="fg.muted">
                {activeCount}/{totalCount}
              </Text>
            </HStack>
          }
        />
        {disabled ? (
          <Text fontSize="xs" color="fg.muted" py={2} textAlign="center">
            {t('chart.layers.noFocusedChart')}
          </Text>
        ) : isLoading ? (
          <Text fontSize="xs" color="fg.muted" py={2} textAlign="center">
            {t('common.loading', { defaultValue: '…' })}
          </Text>
        ) : groups.length === 0 ? (
          <Text fontSize="xs" color="fg.muted" py={2} textAlign="center">
            {t('chart.patterns.empty')}
          </Text>
        ) : (
          groups.map((group) => (
            <Stack key={group.category} gap={1}>
              <PopoverSectionLabel>{t(group.titleKey)}</PopoverSectionLabel>
              {group.items.map((p) => (
                <PopoverToggleItem
                  key={p.id}
                  label={p.label}
                  checked={enabledSet.has(p.id)}
                  onCheckedChange={() => handleToggle(p)}
                  icon={
                    <Flex
                      w="6px"
                      h="6px"
                      borderRadius="full"
                      bg={SENTIMENT_DOT_COLOR[p.definition.sentiment]}
                    />
                  }
                />
              ))}
            </Stack>
          ))
        )}
      </PopoverList>
    </Popover>
  );
});

PatternTogglePopover.displayName = 'PatternTogglePopover';
