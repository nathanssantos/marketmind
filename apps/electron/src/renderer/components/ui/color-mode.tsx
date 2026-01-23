import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { QUERY_CONFIG } from '@shared/constants';
import { trpc } from '../../utils/trpc';

type ColorMode = 'light' | 'dark';

const COLOR_MODE_KEY = 'colorMode';
const DEFAULT_COLOR_MODE: ColorMode = 'dark';

const getInitialColorModeFromDocument = (): ColorMode => {
  if (typeof window === 'undefined') return DEFAULT_COLOR_MODE;
  const root = document.documentElement;
  if (root.classList.contains('light')) return 'light';
  if (root.classList.contains('dark')) return 'dark';
  return DEFAULT_COLOR_MODE;
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
  const [colorMode, setColorModeState] = useState<ColorMode>(getInitialColorModeFromDocument);
  const [mounted, setMounted] = useState(false);
  const isHydratedRef = useRef(false);
  const utils = trpc.useUtils();

  const { data: currentUser } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: QUERY_CONFIG.STALE_TIME.LONG,
  });

  const isAuthenticated = !!currentUser;

  const { data: preferences } = trpc.preferences.getByCategory.useQuery(
    { category: 'ui' },
    {
      enabled: isAuthenticated,
      staleTime: QUERY_CONFIG.STALE_TIME.LONG,
      retry: false,
    }
  );

  const setMutation = trpc.preferences.set.useMutation({
    onSuccess: () => {
      utils.preferences.getByCategory.invalidate({ category: 'ui' });
    },
  });

  useEffect(() => {
    if (preferences && !isHydratedRef.current) {
      const storedMode = preferences[COLOR_MODE_KEY];
      if (storedMode === 'light' || storedMode === 'dark') {
        setColorModeState(storedMode);
      }
      isHydratedRef.current = true;
    }
  }, [preferences]);

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

  const setColorModeAndSync = useCallback((newMode: ColorMode) => {
    setColorModeState(newMode);
    if (isAuthenticated) {
      setMutation.mutate({
        category: 'ui',
        key: COLOR_MODE_KEY,
        value: newMode,
      });
    }
  }, [isAuthenticated, setMutation]);

  const toggleColorMode = useCallback(() => {
    const newMode = colorMode === 'light' ? 'dark' : 'light';
    setColorModeAndSync(newMode);
  }, [colorMode, setColorModeAndSync]);

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeAndSync(mode);
  }, [setColorModeAndSync]);

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
