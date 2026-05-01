import { Box, HStack, SimpleGrid, Text } from '@chakra-ui/react';
import { DialogSection, DialogShell } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';
import {
  formatShortcutKeys,
  type ShortcutDefinition,
  type ShortcutGroupId,
  useKeyboardShortcutStore,
} from '@renderer/services/keyboardShortcuts';
import { useMemo } from 'react';

const GROUP_ORDER: ShortcutGroupId[] = ['chart', 'drawing', 'trading', 'global'];

const KeyBadge = ({ keys }: { keys: string }) => (
  <Box
    px={1.5}
    py={0.5}
    borderRadius="sm"
    borderWidth="1px"
    borderColor="border"
    bg="bg.muted"
    fontFamily="mono"
    fontSize="2xs"
    fontWeight="medium"
    color="fg"
    minW="22px"
    textAlign="center"
  >
    {formatShortcutKeys(keys)}
  </Box>
);

export const KeyboardShortcutHelpDialog = () => {
  const { t } = useTranslation();
  const helpOpen = useKeyboardShortcutStore((s) => s.helpOpen);
  const setHelpOpen = useKeyboardShortcutStore((s) => s.setHelpOpen);
  const shortcuts = useKeyboardShortcutStore((s) => s.shortcuts);

  const grouped = useMemo(() => {
    const visible = Object.values(shortcuts).filter((s) => !s.hidden);
    const groups = new Map<ShortcutGroupId, ShortcutDefinition[]>();
    for (const sc of visible) {
      const list = groups.get(sc.group) ?? [];
      list.push(sc);
      groups.set(sc.group, list);
    }
    return GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({
      id: g,
      shortcuts: (groups.get(g) ?? []).slice().sort((a, b) => a.id.localeCompare(b.id)),
    }));
  }, [shortcuts]);

  return (
    <DialogShell
      isOpen={helpOpen}
      onClose={() => setHelpOpen(false)}
      size="lg"
      title={t('shortcuts.dialogs.help.title')}
      description={t('shortcuts.dialogs.help.description')}
      hideFooter
    >
      {grouped.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">{t('shortcuts.dialogs.help.empty')}</Text>
      ) : (
        grouped.map(({ id, shortcuts: list }) => (
          <DialogSection key={id} title={t(`shortcuts.group.${id}`)}>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={1.5}>
              {list.map((sc) => (
                <HStack key={sc.id} justify="space-between" gap={3} py={0.5}>
                  <Text fontSize="xs" color="fg" lineClamp={1}>
                    {sc.descriptionKey ? t(sc.descriptionKey) : sc.description}
                  </Text>
                  <KeyBadge keys={sc.keys} />
                </HStack>
              ))}
            </SimpleGrid>
          </DialogSection>
        ))
      )}
    </DialogShell>
  );
};
