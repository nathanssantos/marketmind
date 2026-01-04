import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ColorModeProvider, useColorMode } from './color-mode';

const mockUseLocalStorage = vi.fn();
vi.mock('@/renderer/hooks/useLocalStorage', () => ({
  useLocalStorage: (key: string, defaultValue: unknown) => mockUseLocalStorage(key, defaultValue),
}));

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
  let setColorModeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setColorModeMock = vi.fn();

    mockUseLocalStorage.mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'chakra-ui-color-mode') {
        return ['dark', setColorModeMock];
      }
      return [defaultValue, vi.fn()];
    });

    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });

  it('should render children', () => {
    renderWithProviders(
      <ColorModeProvider>
        <div data-testid="child">Child</div>
      </ColorModeProvider>
    );

    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('should provide color mode value', () => {
    renderWithProviders(
      <ColorModeProvider>
        <TestConsumer />
      </ColorModeProvider>
    );

    expect(screen.getByTestId('color-mode').textContent).toBe('dark');
  });

  it('should toggle color mode', async () => {
    mockUseLocalStorage.mockImplementation((key: string) => {
      if (key === 'chakra-ui-color-mode') {
        return ['light', setColorModeMock];
      }
      return ['light', vi.fn()];
    });

    renderWithProviders(
      <ColorModeProvider>
        <TestConsumer />
      </ColorModeProvider>
    );

    const toggleButton = screen.getByTestId('toggle');

    await act(async () => {
      fireEvent.click(toggleButton);
    });

    expect(setColorModeMock).toHaveBeenCalled();
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

    expect(setColorModeMock).toHaveBeenCalledWith('light');
  });

  it('should set color mode to dark', async () => {
    mockUseLocalStorage.mockImplementation((key: string) => {
      if (key === 'chakra-ui-color-mode') {
        return ['light', setColorModeMock];
      }
      return ['light', vi.fn()];
    });

    renderWithProviders(
      <ColorModeProvider>
        <TestConsumer />
      </ColorModeProvider>
    );

    const setDarkButton = screen.getByTestId('set-dark');

    await act(async () => {
      fireEvent.click(setDarkButton);
    });

    expect(setColorModeMock).toHaveBeenCalledWith('dark');
  });

  it('should apply dark class to document', () => {
    renderWithProviders(
      <ColorModeProvider>
        <TestConsumer />
      </ColorModeProvider>
    );

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should apply light class when in light mode', () => {
    mockUseLocalStorage.mockImplementation((key: string) => {
      if (key === 'chakra-ui-color-mode') {
        return ['light', setColorModeMock];
      }
      return ['light', vi.fn()];
    });

    renderWithProviders(
      <ColorModeProvider>
        <TestConsumer />
      </ColorModeProvider>
    );

    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('should toggle from light to dark', async () => {
    let currentMode = 'light';
    setColorModeMock.mockImplementation((updater) => {
      if (typeof updater === 'function') {
        currentMode = updater(currentMode);
      } else {
        currentMode = updater;
      }
    });

    mockUseLocalStorage.mockImplementation((key: string) => {
      if (key === 'chakra-ui-color-mode') {
        return [currentMode, setColorModeMock];
      }
      return [currentMode, vi.fn()];
    });

    renderWithProviders(
      <ColorModeProvider>
        <TestConsumer />
      </ColorModeProvider>
    );

    const toggleButton = screen.getByTestId('toggle');

    await act(async () => {
      fireEvent.click(toggleButton);
    });

    expect(setColorModeMock).toHaveBeenCalled();
  });
});

describe('useColorMode', () => {
  it('should throw error when used outside provider', () => {
    const consoleError = console.error;
    console.error = vi.fn();

    expect(() => {
      renderWithProviders(<TestConsumer />);
    }).toThrow('useColorMode must be used within ColorModeProvider');

    console.error = consoleError;
  });
});
