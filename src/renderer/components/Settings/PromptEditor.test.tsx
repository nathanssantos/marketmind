import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PromptEditor } from './PromptEditor';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockDefaultPrompt = JSON.stringify({
  system: 'You are a helpful assistant',
  disclaimer: 'This is not financial advice'
}, null, 2);

const mockCustomPrompt = JSON.stringify({
  system: 'You are a custom assistant',
  disclaimer: 'Custom disclaimer'
}, null, 2);

const renderWithChakra = (component: React.ReactElement) => {
  return render(
    <ChakraProvider value={defaultSystem}>
      {component}
    </ChakraProvider>
  );
};

describe('PromptEditor', () => {
  it('renders with default value', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();

    renderWithChakra(
      <PromptEditor
        value={mockDefaultPrompt}
        defaultValue={mockDefaultPrompt}
        onChange={onChange}
        onReset={onReset}
        label="Test Prompt"
      />
    );

    expect(screen.getByText('Test Prompt')).toBeDefined();
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe(mockDefaultPrompt);
  });

  it('validates JSON on change', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();

    renderWithChakra(
      <PromptEditor
        value={mockDefaultPrompt}
        defaultValue={mockDefaultPrompt}
        onChange={onChange}
        onReset={onReset}
        label="Test Prompt"
      />
    );

    const textarea = screen.getByRole('textbox');
    
    fireEvent.change(textarea, { target: { value: '{ invalid }' } });

    expect(screen.queryByText(/errorInvalidJson/i)).toBeDefined();
  });

  it('calls onChange when save is clicked with valid JSON', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();

    renderWithChakra(
      <PromptEditor
        value={mockDefaultPrompt}
        defaultValue={mockDefaultPrompt}
        onChange={onChange}
        onReset={onReset}
        label="Test Prompt"
      />
    );

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: mockCustomPrompt } });

    const saveButton = screen.getByText('common.save');
    fireEvent.click(saveButton);

    expect(onChange).toHaveBeenCalledWith(mockCustomPrompt);
  });

  it('calls onReset when reset button is clicked', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();

    renderWithChakra(
      <PromptEditor
        value={mockCustomPrompt}
        defaultValue={mockDefaultPrompt}
        onChange={onChange}
        onReset={onReset}
        label="Test Prompt"
      />
    );

    const resetButton = screen.getByText('settings.prompt.resetToDefault');
    fireEvent.click(resetButton);

    expect(onReset).toHaveBeenCalled();
  });

  it('renders with description when provided', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();

    renderWithChakra(
      <PromptEditor
        value={mockDefaultPrompt}
        defaultValue={mockDefaultPrompt}
        onChange={onChange}
        onReset={onReset}
        label="Test Prompt"
        description="This is a test description"
      />
    );

    expect(screen.getByText('This is a test description')).toBeDefined();
  });
});
