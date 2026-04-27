import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormSection, FormRow } from './form-section';

const renderWithChakra = (ui: React.ReactElement) =>
  render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);

describe('FormSection', () => {
  it('renders children without title', () => {
    renderWithChakra(
      <FormSection>
        <div>child</div>
      </FormSection>
    );
    expect(screen.getByText('child')).toBeDefined();
  });

  it('renders title + description + action together', () => {
    renderWithChakra(
      <FormSection title="My section" description="Helpful description" action={<button>Reset</button>}>
        <div>body</div>
      </FormSection>
    );
    expect(screen.getByText('My section')).toBeDefined();
    expect(screen.getByText('Helpful description')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDefined();
    expect(screen.getByText('body')).toBeDefined();
  });

  it('does not render header block when no title or action', () => {
    const { container } = renderWithChakra(
      <FormSection>
        <div data-testid="body">body</div>
      </FormSection>
    );
    expect(screen.queryByText('My section')).toBeNull();
    expect(container.querySelector('[data-testid="body"]')).not.toBeNull();
  });

  it('renders header when only action is provided (no title)', () => {
    renderWithChakra(
      <FormSection action={<button>Action</button>}>
        <div>body</div>
      </FormSection>
    );
    expect(screen.getByRole('button', { name: 'Action' })).toBeDefined();
  });

  it('respects custom contentGap', () => {
    // Behavior smoke — child renders. Visual gap is layout, not asserted here.
    renderWithChakra(
      <FormSection title="t" contentGap={5}>
        <div>a</div>
        <div>b</div>
      </FormSection>
    );
    expect(screen.getByText('a')).toBeDefined();
    expect(screen.getByText('b')).toBeDefined();
  });
});

describe('FormRow', () => {
  it('renders label + control together', () => {
    renderWithChakra(
      <FormRow label="Setting">
        <input type="checkbox" data-testid="ctrl" />
      </FormRow>
    );
    expect(screen.getByText('Setting')).toBeDefined();
    expect(screen.getByTestId('ctrl')).toBeDefined();
  });

  it('renders helper text under the label', () => {
    renderWithChakra(
      <FormRow label="Lab" helper="Hint text">
        <input data-testid="ctrl" />
      </FormRow>
    );
    expect(screen.getByText('Hint text')).toBeDefined();
  });

  it('renders without label (control only)', () => {
    renderWithChakra(
      <FormRow>
        <input data-testid="ctrl" />
      </FormRow>
    );
    expect(screen.getByTestId('ctrl')).toBeDefined();
  });

  it('renders action slot', () => {
    renderWithChakra(
      <FormRow label="Lab">
        <input data-testid="ctrl" />
        <button>Edit</button>
      </FormRow>
    );
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined();
  });
});
