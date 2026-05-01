import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChecklistEditor } from './ChecklistEditor';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

describe('ChecklistEditor', () => {
  it('renders the empty-state when conditions is empty', () => {
    render(
      <ChakraProvider value={defaultSystem}>
        <ChecklistEditor conditions={[]} availableIndicators={[]} onChange={vi.fn()} />
      </ChakraProvider>,
    );
    expect(screen.getByText('checklist.editor.emptyTitle')).toBeDefined();
    expect(screen.getByText('checklist.editor.emptyDescription')).toBeDefined();
  });
});
