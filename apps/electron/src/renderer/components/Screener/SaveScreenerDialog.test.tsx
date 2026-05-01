import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SaveScreenerDialog } from './SaveScreenerDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const wrap = (ui: React.ReactElement) => (
  <ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>
);

describe('SaveScreenerDialog', () => {
  it('renders the title and submit button', () => {
    render(
      wrap(
        <SaveScreenerDialog isOpen onClose={vi.fn()} onSave={vi.fn()} isLoading={false} />,
      ),
    );
    expect(screen.getByText('screener.dialogs.saveScreener.title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'screener.dialogs.saveScreener.submit' })).toBeInTheDocument();
  });

  it('disables submit when name is empty', () => {
    render(
      wrap(
        <SaveScreenerDialog isOpen onClose={vi.fn()} onSave={vi.fn()} isLoading={false} />,
      ),
    );
    expect(screen.getByRole('button', { name: 'screener.dialogs.saveScreener.submit' })).toBeDisabled();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      wrap(
        <SaveScreenerDialog isOpen={false} onClose={vi.fn()} onSave={vi.fn()} isLoading={false} />,
      ),
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
