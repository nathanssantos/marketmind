import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KeyboardShortcutHelpDialog } from './KeyboardShortcutHelpDialog';
import { useKeyboardShortcutStore } from '@renderer/services/keyboardShortcuts';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const wrap = (ui: React.ReactElement) => (
  <ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>
);

describe('KeyboardShortcutHelpDialog', () => {
  it('renders the title and description when open', () => {
    useKeyboardShortcutStore.setState({ helpOpen: true, shortcuts: {} });
    render(wrap(<KeyboardShortcutHelpDialog />));
    expect(screen.getByText('shortcuts.dialogs.help.title')).toBeInTheDocument();
    expect(screen.getByText('shortcuts.dialogs.help.description')).toBeInTheDocument();
  });

  it('renders an EmptyState when no shortcuts are registered', () => {
    useKeyboardShortcutStore.setState({ helpOpen: true, shortcuts: {} });
    render(wrap(<KeyboardShortcutHelpDialog />));
    expect(screen.getByText('shortcuts.dialogs.help.emptyTitle')).toBeInTheDocument();
    expect(screen.getByText('shortcuts.dialogs.help.emptyDescription')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    useKeyboardShortcutStore.setState({ helpOpen: false, shortcuts: {} });
    const { container } = render(wrap(<KeyboardShortcutHelpDialog />));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
