import { Flex, HStack, Stack, Text } from '@chakra-ui/react';
import type { UserIndicator } from '@marketmind/trading-core';
import { INDICATOR_CATALOG } from '@marketmind/trading-core';
import { Badge, Button, ConfirmationDialog, EmptyState, FormSection, IconButton, TooltipWrapper } from '@renderer/components/ui';
import { useUserIndicators } from '@renderer/hooks';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCopy, LuPencil, LuPlus, LuRotateCcw, LuTrash2 } from 'react-icons/lu';
import { groupByCategory } from '../Layout/IndicatorTogglePopoverGeneric';
import {
  IndicatorConfigDialog,
  type IndicatorConfigResult,
} from './IndicatorConfigDialog';

type DialogState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; indicator: UserIndicator };

const formatParamsSummary = (indicator: UserIndicator): string => {
  const def = INDICATOR_CATALOG[indicator.catalogType];
  if (!def) return '';
  const parts: string[] = [];
  for (const schema of def.params) {
    if (schema.cosmetic) continue;
    const value = indicator.params[schema.key];
    if (value === undefined || value === null) continue;
    parts.push(`${schema.key}=${value}`);
  }
  return parts.join(' · ');
};

export const IndicatorLibrary = () => {
  const { t } = useTranslation();
  const { indicators, isLoading, create, update, remove, duplicate, reset } = useUserIndicators();

  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
  const [confirmDelete, setConfirmDelete] = useState<UserIndicator | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const groups = useMemo(() => groupByCategory(indicators), [indicators]);

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

  const handleDuplicate = useCallback(
    (id: string) => {
      void duplicate.mutateAsync({ id });
    },
    [duplicate],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDelete) return;
    await remove.mutateAsync({ id: confirmDelete.id });
    setConfirmDelete(null);
  }, [confirmDelete, remove]);

  const handleConfirmReset = useCallback(async () => {
    await reset.mutateAsync();
    setConfirmReset(false);
  }, [reset]);

  return (
    <Stack gap={5}>
      <FormSection
        title={t('settings.indicators.title')}
        description={t('settings.indicators.count', { count: indicators.length })}
        action={
          <HStack gap={2}>
            <Button
              size="2xs"
              variant="outline"
              onClick={() => setConfirmReset(true)}
              disabled={isLoading || reset.isPending}
            >
              <LuRotateCcw />
              {t('settings.indicators.reset')}
            </Button>
            <Button
              size="2xs"
              colorPalette="blue"
              onClick={() => setDialog({ kind: 'create' })}
              disabled={isLoading}
            >
              <LuPlus />
              {t('settings.indicators.new')}
            </Button>
          </HStack>
        }
      />

      {groups.length === 0 && !isLoading && (
        <EmptyState
          title={t('settings.indicators.emptyTitle')}
          description={t('settings.indicators.emptyDescription')}
        />
      )}

      {groups.map((group) => (
        <FormSection key={group.category} title={t(group.titleKey)}>
          <Stack gap={1}>
            {group.items.map((ui) => {
              const summary = formatParamsSummary(ui);
              return (
                <Flex
                  key={ui.id}
                  align="center"
                  justify="space-between"
                  px={3}
                  py={2}
                  borderWidth="1px"
                  borderColor="border.subtle"
                  rounded="md"
                  gap={3}
                >
                  <Stack gap={0.5} flex={1} minW={0}>
                    <HStack gap={2}>
                      <Text fontSize="sm" fontWeight="medium" truncate>
                        {ui.label}
                      </Text>
                      {ui.isCustom && (
                        <Badge size="xs" colorPalette="purple">
                          {t('settings.indicators.custom')}
                        </Badge>
                      )}
                    </HStack>
                    {summary && (
                      <Text fontSize="xs" color="fg.muted" truncate>
                        {summary}
                      </Text>
                    )}
                  </Stack>
                  <HStack gap={1}>
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
                    <TooltipWrapper label={t('settings.indicators.duplicate')}>
                      <IconButton
                        aria-label={t('settings.indicators.duplicate')}
                        size="2xs"
                        variant="ghost"
                        onClick={() => handleDuplicate(ui.id)}
                        disabled={duplicate.isPending}
                      >
                        <LuCopy />
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
        </FormSection>
      ))}

      <IndicatorConfigDialog
        isOpen={dialog.kind !== 'closed'}
        onClose={() => setDialog({ kind: 'closed' })}
        mode={dialog.kind === 'edit' ? 'edit' : 'create'}
        instance={dialog.kind === 'edit' ? dialog.indicator : undefined}
        isLoading={create.isPending || update.isPending}
        onSubmit={(result) => { void handleSubmit(result); }}
      />

      <ConfirmationDialog
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { void handleConfirmDelete(); }}
        title={t('settings.indicators.deleteTitle')}
        description={t('settings.indicators.deleteDescription', { label: confirmDelete?.label ?? '' })}
        isDestructive
        isLoading={remove.isPending}
      />

      <ConfirmationDialog
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => { void handleConfirmReset(); }}
        title={t('settings.indicators.resetTitle')}
        description={t('settings.indicators.resetDescription')}
        isDestructive
        isLoading={reset.isPending}
      />
    </Stack>
  );
};
