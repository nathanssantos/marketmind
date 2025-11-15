import { Dialog } from '@/renderer/components/ui/dialog';
import { getModifierKey } from '@/renderer/hooks/useKeyboardShortcut';
import { Box, CloseButton, Stack, Text } from '@chakra-ui/react';

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutSection {
  title: string;
  shortcuts: Array<{
    keys: string;
    description: string;
  }>;
}

const modKey = getModifierKey();

const sections: ShortcutSection[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: `${modKey} + ,`, description: 'Open Settings' },
      { keys: `${modKey} + K`, description: 'Focus Chat Input' },
      { keys: `${modKey} + B`, description: 'Toggle Chat Sidebar' },
      { keys: `${modKey} + /`, description: 'Show Keyboard Shortcuts' },
      { keys: 'Esc', description: 'Close Dialogs' },
    ],
  },
  {
    title: 'Chart Controls',
    shortcuts: [
      { keys: 'M', description: 'Toggle Volume Display' },
      { keys: 'G', description: 'Toggle Grid Display' },
      { keys: 'T', description: 'Switch Chart Type' },
      { keys: '1-5', description: 'Toggle Moving Averages' },
      { keys: '+', description: 'Zoom In' },
      { keys: '-', description: 'Zoom Out' },
      { keys: '0', description: 'Reset Zoom' },
      { keys: '← →', description: 'Pan Left/Right' },
      { keys: 'Space + Drag', description: 'Pan Chart' },
    ],
  },
  {
    title: 'Chat Interface',
    shortcuts: [
      { keys: 'Enter', description: 'Send Message' },
      { keys: 'Shift + Enter', description: 'New Line' },
      { keys: '↑', description: 'Edit Last Message' },
      { keys: `${modKey} + L`, description: 'Clear Chat History' },
    ],
  },
  {
    title: 'Symbol Selector',
    shortcuts: [
      { keys: `${modKey} + P`, description: 'Open Symbol Selector' },
      { keys: '↑ ↓', description: 'Navigate Symbol List' },
      { keys: 'Enter', description: 'Select Symbol' },
      { keys: 'Esc', description: 'Close Selector' },
    ],
  },
];

export const KeyboardShortcutsDialog = ({ isOpen, onClose }: KeyboardShortcutsDialogProps) => (
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
          <Dialog.Title>Keyboard Shortcuts</Dialog.Title>
        </Dialog.Header>
      
        <Dialog.Body overflowY="auto">
          <Stack gap={6} py={2}>
            {sections.map((section) => (
              <Box key={section.title}>
                <Text fontSize="sm" fontWeight="bold" color="fg.muted" mb={3}>
                  {section.title}
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
                        {shortcut.description}
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
