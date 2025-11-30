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

  it('does not call onChange when save is clicked with invalid JSON', () => {
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
    fireEvent.change(textarea, { target: { value: '{ invalid json' } });

    const saveButton = screen.getByText('common.save');
    fireEvent.click(saveButton);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('formats JSON correctly', () => {
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
    const unformattedJson = '{"system":"test","disclaimer":"test"}';
    fireEvent.change(textarea, { target: { value: unformattedJson } });

    const formatButton = screen.getByText('settings.prompt.formatJson');
    fireEvent.click(formatButton);

    const expectedFormatted = JSON.stringify(JSON.parse(unformattedJson), null, 2);
    expect((textarea as HTMLTextAreaElement).value).toBe(expectedFormatted);
  });

  it('handles format error gracefully', () => {
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

    const formatButton = screen.getByText('settings.prompt.formatJson');
    fireEvent.click(formatButton);

    expect(screen.queryByText(/errorInvalidJson/i)).toBeDefined();
  });

  it('cancels unsaved changes', () => {
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

    const cancelButton = screen.getByText('common.cancel');
    fireEvent.click(cancelButton);

    expect((textarea as HTMLTextAreaElement).value).toBe(mockDefaultPrompt);
  });

  it('shows custom prompt warning when value is modified', () => {
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

    expect(screen.getByText(/customPromptWarning/i)).toBeDefined();
  });

  it('shows default value when prompt is modified', () => {
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

    expect(screen.getByText(/defaultValue/i)).toBeDefined();
  });

  it('validates empty JSON', () => {
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
    fireEvent.change(textarea, { target: { value: '   ' } });

    expect(screen.queryByText(/errorEmpty/i)).toBeDefined();
  });

  it('handles non-Error exceptions in JSON validation', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();

    const originalParse = JSON.parse;
    JSON.parse = vi.fn(() => {
      throw 'string error';
    });

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
    fireEvent.change(textarea, { target: { value: 'test' } });

    expect(screen.queryByText(/errorInvalidJson/i)).toBeDefined();

    JSON.parse = originalParse;
  });

  it('disables save button when no changes', () => {
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

    const saveButton = screen.getByText('common.save').closest('button');
    expect(saveButton?.disabled).toBe(true);
  });
});
