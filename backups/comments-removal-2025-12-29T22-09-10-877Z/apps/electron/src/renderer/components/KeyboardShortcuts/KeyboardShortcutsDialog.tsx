import { Dialog } from '@/renderer/components/ui/dialog';
import { getModifierKey } from '@/renderer/hooks/useKeyboardShortcut';
import { Box, CloseButton, Stack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutSection {
  titleKey: string;
  shortcuts: Array<{
    keys: string;
    descriptionKey: string;
  }>;
}

const modKey = getModifierKey();

export const KeyboardShortcutsDialog = ({ isOpen, onClose }: KeyboardShortcutsDialogProps) => {
  const { t } = useTranslation();

  const sections: ShortcutSection[] = [
    {
      titleKey: 'keyboardShortcuts.global',
      shortcuts: [
        { keys: `${modKey} + ,`, descriptionKey: 'keyboardShortcuts.shortcuts.openSettings' },
        { keys: `${modKey} + /`, descriptionKey: 'keyboardShortcuts.shortcuts.showKeyboardShortcuts' },
        { keys: 'Esc', descriptionKey: 'keyboardShortcuts.shortcuts.closeDialogs' },
      ],
    },
    {
      titleKey: 'keyboardShortcuts.chartControls',
      shortcuts: [
        { keys: 'M', descriptionKey: 'keyboardShortcuts.shortcuts.toggleVolume' },
        { keys: 'G', descriptionKey: 'keyboardShortcuts.shortcuts.toggleGrid' },
        { keys: 'T', descriptionKey: 'keyboardShortcuts.shortcuts.switchChartType' },
        { keys: '1-5', descriptionKey: 'keyboardShortcuts.shortcuts.toggleMovingAverages' },
        { keys: '+', descriptionKey: 'keyboardShortcuts.shortcuts.zoomIn' },
        { keys: '-', descriptionKey: 'keyboardShortcuts.shortcuts.zoomOut' },
        { keys: '0', descriptionKey: 'keyboardShortcuts.shortcuts.resetZoom' },
        { keys: '← →', descriptionKey: 'keyboardShortcuts.shortcuts.panLeftRight' },
        { keys: 'Space + Drag', descriptionKey: 'keyboardShortcuts.shortcuts.panChart' },
      ],
    },
    {
      titleKey: 'keyboardShortcuts.symbolSelector',
      shortcuts: [
        { keys: `${modKey} + P`, descriptionKey: 'keyboardShortcuts.shortcuts.openSymbolSelector' },
        { keys: '↑ ↓', descriptionKey: 'keyboardShortcuts.shortcuts.navigateSymbolList' },
        { keys: 'Enter', descriptionKey: 'keyboardShortcuts.shortcuts.selectSymbol' },
        { keys: 'Esc', descriptionKey: 'keyboardShortcuts.shortcuts.closeSelector' },
      ],
    },
  ];

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="lg">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxH="85vh">
          <CloseButton
            position="absolute"
            top={4}
            right={4}
            onClick={onClose}
            size="sm"
          />
          <Dialog.Header>
            <Dialog.Title>{t('keyboardShortcuts.title')}</Dialog.Title>
          </Dialog.Header>

          <Dialog.Body overflowY="auto">
            <Stack gap={6} py={2}>
              {sections.map((section) => (
                <Box key={section.titleKey}>
                  <Text fontSize="sm" fontWeight="bold" color="fg.muted" mb={3}>
                    {t(section.titleKey)}
                  </Text>
                  <Stack gap={2}>
                    {section.shortcuts.map((shortcut, index) => (
                      <Box
                        key={index}
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        p={2}
                        borderRadius="md"
                        _hover={{ bg: 'bg.muted' }}
                      >
                        <Text fontSize="sm" color="fg">
                          {t(shortcut.descriptionKey)}
                        </Text>
                        <Box
                          px={3}
                          py={1}
                          bg="bg.muted"
                          borderRadius="md"
                          borderWidth="1px"
                          borderColor="border"
                        >
                          <Text fontSize="xs" fontFamily="mono" color="fg.muted" fontWeight="medium">
                            {shortcut.keys}
                          </Text>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
