import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

const renderWithProvider = (ui: React.ReactElement) =>
  render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);

describe('PasswordStrengthMeter', () => {
  it('renders nothing when password is empty', () => {
    const { container } = renderWithProvider(<PasswordStrengthMeter password="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when visible=false', () => {
    const { container } = renderWithProvider(<PasswordStrengthMeter password="abc" visible={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the rule confluence for any non-empty password', () => {
    renderWithProvider(<PasswordStrengthMeter password="abc" />);
    expect(screen.getByText('auth.passwordPolicy.tooShort')).toBeInTheDocument();
    expect(screen.getByText('auth.passwordPolicy.noUppercase')).toBeInTheDocument();
    expect(screen.getByText('auth.passwordPolicy.noDigit')).toBeInTheDocument();
    expect(screen.getByText('auth.passwordPolicy.noSymbol')).toBeInTheDocument();
  });

  it('shows the common-password line when triggered', () => {
    renderWithProvider(<PasswordStrengthMeter password="Password123" />);
    expect(screen.getByText('auth.passwordPolicy.common')).toBeInTheDocument();
  });

  it('does not show the common-password line for non-common inputs', () => {
    renderWithProvider(<PasswordStrengthMeter password="Aa1!aaaa" />);
    expect(screen.queryByText('auth.passwordPolicy.common')).not.toBeInTheDocument();
  });
});
