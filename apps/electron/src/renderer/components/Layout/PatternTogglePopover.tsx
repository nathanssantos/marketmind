import { Flex, HStack, Stack, Text } from '@chakra-ui/react';
import type { PatternCategory, PatternDefinition } from '@marketmind/trading-core';
import {
  Button,
  ConfirmationDialog,
  IconButton,
  Popover,
  PopoverList,
  PopoverListHeader,
  PopoverSectionLabel,
  PopoverToggleItem,
  TooltipWrapper,
} from '@renderer/components/ui';
import { PatternConfigDialog } from '@renderer/components/Patterns/PatternConfigDialog';
import { useUserPatterns, type UserPattern } from '@renderer/hooks/useUserPatterns';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { usePatternStore } from '@renderer/store';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCopy, LuFlag, LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';

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

type DialogState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; pattern: UserPattern };

export interface PatternTogglePopoverProps {
  triggerVariant?: 'icon' | 'labeled';
  popoverPlacement?: 'right-start' | 'bottom-start';
}

export const PatternTogglePopover = memo(({ triggerVariant = 'labeled', popoverPlacement = 'bottom-start' }: PatternTogglePopoverProps = {}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
  const [confirmDelete, setConfirmDelete] = useState<UserPattern | null>(null);

  const { patterns, isLoading, create, update, duplicate, remove } = useUserPatterns();

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

  const handleSubmit = useCallback(
    async (definition: PatternDefinition) => {
      if (dialog.kind === 'create') {
        await create.mutateAsync({ definition });
      } else if (dialog.kind === 'edit') {
        await update.mutateAsync({ id: dialog.pattern.id, definition });
      }
      setDialog({ kind: 'closed' });
    },
    [dialog, create, update],
  );

  const handleDuplicate = useCallback(async (p: UserPattern) => {
    await duplicate.mutateAsync({ id: p.id });
  }, [duplicate]);

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDelete) return;
    await remove.mutateAsync({ id: confirmDelete.id });
    setConfirmDelete(null);
  }, [confirmDelete, remove]);

  return (
    <>
      <Popover
        open={isOpen}
        onOpenChange={(e) => setIsOpen(e.open)}
        showArrow={false}
        width="380px"
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
                <Button
                  size="2xs"
                  variant="outline"
                  color="fg.muted"
                  onClick={() => setDialog({ kind: 'create' })}
                >
                  <LuPlus />
                  {t('chart.patterns.new', { defaultValue: 'New' })}
                </Button>
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
                    trailing={
                      <HStack gap={0.5}>
                        <TooltipWrapper label={t('common.edit', { defaultValue: 'Edit' })}>
                          <IconButton
                            aria-label={t('common.edit', { defaultValue: 'Edit' })}
                            size="2xs"
                            variant="ghost"
                            onClick={() => setDialog({ kind: 'edit', pattern: p })}
                          >
                            <LuPencil />
                          </IconButton>
                        </TooltipWrapper>
                        <TooltipWrapper label={t('common.duplicate', { defaultValue: 'Duplicate' })}>
                          <IconButton
                            aria-label={t('common.duplicate', { defaultValue: 'Duplicate' })}
                            size="2xs"
                            variant="ghost"
                            onClick={() => { void handleDuplicate(p); }}
                          >
                            <LuCopy />
                          </IconButton>
                        </TooltipWrapper>
                        {p.isCustom ? (
                          <TooltipWrapper label={t('common.delete', { defaultValue: 'Delete' })}>
                            <IconButton
                              aria-label={t('common.delete', { defaultValue: 'Delete' })}
                              size="2xs"
                              variant="ghost"
                              colorPalette="red"
                              onClick={() => setConfirmDelete(p)}
                            >
                              <LuTrash2 />
                            </IconButton>
                          </TooltipWrapper>
                        ) : null}
                      </HStack>
                    }
                  />
                ))}
              </Stack>
            ))
          )}
        </PopoverList>
      </Popover>

      <PatternConfigDialog
        isOpen={dialog.kind !== 'closed'}
        onClose={() => setDialog({ kind: 'closed' })}
        mode={dialog.kind === 'edit' ? 'edit' : 'create'}
        {...(dialog.kind === 'edit' ? { pattern: dialog.pattern } : {})}
        isLoading={create.isPending || update.isPending}
        onSubmit={(def) => { void handleSubmit(def); }}
      />

      <ConfirmationDialog
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { void handleConfirmDelete(); }}
        title={t('chart.patterns.deleteTitle', { defaultValue: 'Delete pattern' })}
        description={t('chart.patterns.deleteDescription', {
          defaultValue: 'Permanently delete "{{label}}"? This cannot be undone.',
          label: confirmDelete?.label ?? '',
        })}
        isDestructive
        isLoading={remove.isPending}
      />
    </>
  );
});

PatternTogglePopover.displayName = 'PatternTogglePopover';
