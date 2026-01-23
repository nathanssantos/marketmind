import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { ColorModeProvider, useColorMode } from './color-mode';

const TestConsumer = () => {
  const { colorMode, toggleColorMode, setColorMode } = useColorMode();
  return (
    <div>
      <span data-testid="color-mode">{colorMode}</span>
      <button data-testid="toggle" onClick={toggleColorMode}>Toggle</button>
      <button data-testid="set-light" onClick={() => setColorMode('light')}>Light</button>
      <button data-testid="set-dark" onClick={() => setColorMode('dark')}>Dark</button>
    </div>
  );
};

const renderWithProviders = (ui: ReactElement) =>
  render(
    <ChakraProvider value={defaultSystem}>
      {ui}
    </ChakraProvider>
  );

describe('ColorModeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should render children', () => {
    renderWithProviders(
      <ColorModeProvider>
        <div data-testid="child">Child</div>
      </ColorModeProvider>
    );

    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('should default to dark mode when no localStorage value', () => {
    renderWithProviders(
      <ColorModeProvider>
        <TestConsumer />
      </ColorModeProvider>
    );

    expect(screen.getByTestId('color-mode').textContent).toBe('dark');
  });

  it('should read initial value from localStorage', () => {
    localStorage.setItem('chakra-ui-color-mode', 'light');

    renderWithProviders(
      <ColorModeProvider>
        <TestConsumer />
      </ColorModeProvider>
    );

    expect(screen.getByTestId('color-mode').textContent).toBe('light');
  });

  it('should toggle color mode from dark to light', async () => {
    renderWithProviders(
      <ColorModeProvider>
        <TestConsumer />
      </ColorModeProvider>
    );

    expect(screen.getByTestId('color-mode').textContent).toBe('dark');

    const toggleButton = screen.getByTestId('toggle');

    await act(async () => {
      fireEvent.click(toggleButton);
    });

    expect(screen.getByTestId('color-mode').textContent).toBe('light');
    expect(localStorage.getItem('chakra-ui-color-mode')).toBe('light');
  });

  it('should toggle color mode from light to dark', async () => {
    localStorage.setItem('chakra-ui-color-mode', 'light');

    renderWithProviders(
      <ColorModeProvider>
        <TestConsumer />
      </ColorModeProvider>
    );

    expect(screen.getByTestId('color-mode').textContent).toBe('light');

    const toggleButton = screen.getByTestId('toggle');

    await act(async () => {
      fireEvent.click(toggleButton);
    });

    expect(screen.getByTestId('color-mode').textContent).toBe('dark');
    expect(localStorage.getItem('chakra-ui-color-mode')).toBe('dark');
  });

  it('should set color mode to light', async () => {
    renderWithProviders(
      <ColorModeProvider>
        <TestConsumer />
      </ColorModeProvider>
    );

    const setLightButton = screen.getByTestId('set-light');

    await act(async () => {
      fireEvent.click(setLightButton);
    });

    expect(screen.getByTestId('color-mode').textContent).toBe('light');
    expect(localStorage.getItem('chakra-ui-color-mode')).toBe('light');
  });

  it('should set color mode to dark', async () => {
    localStorage.setItem('chakra-ui-color-mode', 'light');

    renderWithProviders(
      <ColorModeProvider>
        <TestConsumer />
      </ColorModeProvider>
    );

    const setDarkButton = screen.getByTestId('set-dark');

    await act(async () => {
      fireEvent.click(setDarkButton);
    });

    expect(screen.getByTestId('color-mode').textContent).toBe('dark');
    expect(localStorage.getItem('chakra-ui-color-mode')).toBe('dark');
  });

  it('should apply dark class to document', async () => {
    renderWithProviders(
      <ColorModeProvider>
        <TestConsumer />
      </ColorModeProvider>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should apply light class when in light mode', async () => {
    localStorage.setItem('chakra-ui-color-mode', 'light');

    renderWithProviders(
      <ColorModeProvider>
        <TestConsumer />
      </ColorModeProvider>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(document.documentElement.classList.contains('light')).toBe(true);
  });
});

describe('useColorMode', () => {
  it('should throw error when used outside provider', () => {
    const consoleError = console.error;
    console.error = () => {};

    expect(() => {
      renderWithProviders(<TestConsumer />);
    }).toThrow('useColorMode must be used within ColorModeProvider');

    console.error = consoleError;
  });
});
