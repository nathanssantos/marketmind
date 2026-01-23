import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type ColorMode = 'light' | 'dark';

const COLOR_MODE_KEY = 'chakra-ui-color-mode';

const getInitialColorMode = (): ColorMode => {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(COLOR_MODE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Ignore localStorage errors
  }
  return 'dark';
};

interface ColorModeContextValue {
  colorMode: ColorMode;
  toggleColorMode: () => void;
  setColorMode: (mode: ColorMode) => void;
}

const ColorModeContext = createContext<ColorModeContextValue | undefined>(undefined);

export const useColorMode = () => {
  const context = useContext(ColorModeContext);
  if (!context) {
    throw new Error('useColorMode must be used within ColorModeProvider');
  }
  return context;
};

interface ColorModeProviderProps {
  children: React.ReactNode;
}

export const ColorModeProvider = ({ children }: ColorModeProviderProps) => {
  const [colorMode, setColorModeState] = useState<ColorMode>(getInitialColorMode);

  const setColorModeStorage = useCallback((value: ColorMode | ((prev: ColorMode) => ColorMode)) => {
    setColorModeState((prev) => {
      const newMode = typeof value === 'function' ? value(prev) : value;
      try {
        window.localStorage.setItem(COLOR_MODE_KEY, newMode);
      } catch {
        // Ignore localStorage errors
      }
      return newMode;
    });
  }, []);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(colorMode);
    root.style.colorScheme = colorMode;
    root.setAttribute('data-theme', colorMode);
  }, [colorMode, mounted]);

  const toggleColorMode = () => {
    setColorModeStorage((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setColorMode = (mode: ColorMode) => {
    setColorModeStorage(mode);
  };

  const value: ColorModeContextValue = {
    colorMode,
    toggleColorMode,
    setColorMode,
  };

  return (
    <ColorModeContext.Provider value={value}>
      {children}
    </ColorModeContext.Provider>
  );
};
