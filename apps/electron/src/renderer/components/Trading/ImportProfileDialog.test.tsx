import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const importMutationMock = {
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) =>
      opts?.count !== undefined ? `${key}:${opts.count}` : key,
  }),
}));

vi.mock('@renderer/utils/trpc', () => ({
  trpc: {
    useUtils: () => ({ tradingProfiles: { list: { invalidate: vi.fn() } } }),
    tradingProfiles: {
      importFromBacktest: { useMutation: () => importMutationMock },
    },
  },
}));

import { ImportProfileDialog } from './ImportProfileDialog';

const renderDialog = () => {
  const onClose = vi.fn();
  return {
    ...render(
      <ChakraProvider value={defaultSystem}>
        <ImportProfileDialog isOpen onClose={onClose} />
      </ChakraProvider>
    ),
    onClose,
  };
};

describe('ImportProfileDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the import title when open', () => {
    renderDialog();
    expect(screen.getByText('tradingProfiles.import.title')).toBeDefined();
  });

  it('renders name input + JSON textarea', () => {
    renderDialog();
    expect(screen.getByPlaceholderText('tradingProfiles.import.namePlaceholder')).toBeDefined();
    // Textarea — find by its label key
    expect(screen.getByText('tradingProfiles.import.pasteJson')).toBeDefined();
  });

  it('shows preview Callout when valid JSON pasted', () => {
    renderDialog();
    const textarea = document.querySelector('textarea');
    if (!textarea) throw new Error('textarea not found');
    fireEvent.change(textarea, {
      target: { value: JSON.stringify({ name: 'Test Profile', enabledSetupTypes: ['rsi-bull', 'macd-bear'] }) },
    });
    expect(screen.getByText('tradingProfiles.import.preview')).toBeDefined();
    expect(screen.getByText('rsi-bull')).toBeDefined();
    expect(screen.getByText('macd-bear')).toBeDefined();
  });

  it('shows error helper when JSON is invalid', () => {
    renderDialog();
    const textarea = document.querySelector('textarea');
    if (!textarea) throw new Error('textarea not found');
    fireEvent.change(textarea, { target: { value: '{not valid json' } });
    expect(screen.getByText('tradingProfiles.import.invalidJson')).toBeDefined();
  });

  it('shows error helper when enabledSetupTypes missing', () => {
    renderDialog();
    const textarea = document.querySelector('textarea');
    if (!textarea) throw new Error('textarea not found');
    fireEvent.change(textarea, { target: { value: '{"name":"X"}' } });
    expect(screen.getByText('tradingProfiles.import.invalidJson')).toBeDefined();
  });

  it('autofills profile name from JSON.name field', () => {
    renderDialog();
    const textarea = document.querySelector('textarea');
    if (!textarea) throw new Error('textarea not found');
    fireEvent.change(textarea, {
      target: { value: JSON.stringify({ name: 'Auto-named', enabledSetupTypes: [] }) },
    });
    const nameInput = screen.getByPlaceholderText('tradingProfiles.import.namePlaceholder') as HTMLInputElement;
    expect(nameInput.value).toBe('Auto-named');
  });

  it('disables import button until valid JSON + name', () => {
    renderDialog();
    const importBtn = screen.getByRole('button', { name: 'tradingProfiles.import.importButton' });
    expect((importBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls import mutation with parsed config when import clicked', () => {
    renderDialog();
    const textarea = document.querySelector('textarea');
    if (!textarea) throw new Error('textarea not found');
    fireEvent.change(textarea, {
      target: { value: JSON.stringify({ name: 'Test', enabledSetupTypes: ['x'] }) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'tradingProfiles.import.importButton' }));
    expect(importMutationMock.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test', enabledSetupTypes: ['x'] })
    );
  });
});
