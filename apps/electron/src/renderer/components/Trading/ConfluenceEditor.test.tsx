import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfluenceEditor } from './ConfluenceEditor';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

describe('ConfluenceEditor', () => {
  it('renders the empty-state when conditions is empty', () => {
    render(
      <ChakraProvider value={defaultSystem}>
        <ConfluenceEditor conditions={[]} availableIndicators={[]} onChange={vi.fn()} />
      </ChakraProvider>,
    );
    expect(screen.getByText('confluence.editor.emptyTitle')).toBeDefined();
    expect(screen.getByText('confluence.editor.emptyDescription')).toBeDefined();
  });
});
