import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { QUERY_CONFIG } from '@shared/constants';
import { trpc } from '../../utils/trpc';
import { exposeColorModeForE2E } from '../../utils/e2eBridge';

type ColorMode = 'light' | 'dark';

const COLOR_MODE_KEY = 'colorMode';
const DEFAULT_COLOR_MODE: ColorMode = 'dark';

const getInitialColorModeFromDocument = (): ColorMode => {
  if (typeof window === 'undefined') return DEFAULT_COLOR_MODE;
  // Check the class first (set by the index.html bootstrap script)
  // so React's initial state matches the pre-mount paint and we avoid
  // a flicker if React's state and the document class disagree.
  const root = document.documentElement;
  if (root.classList.contains('light')) return 'light';
  if (root.classList.contains('dark')) return 'dark';
  // Bootstrap script disabled (e.g. unit test) — fall back to
  // localStorage then default.
  try {
    const stored = localStorage.getItem('chakra-ui-color-mode');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* localStorage unavailable */
  }
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
      void utils.preferences.getByCategory.invalidate({ category: 'ui' });
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
    // Persist to localStorage so the next cold load can apply the
    // class on <html> BEFORE React mounts (see index.html bootstrap
    // script). Without this, dark-mode users get a white flash on
    // every reload while waiting for the backend prefs query.
    try {
      localStorage.setItem('chakra-ui-color-mode', newMode);
    } catch {
      // localStorage unavailable (private mode, etc.) — fall back to
      // the existing backend-prefs path below.
    }
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

  useEffect(() => {
    exposeColorModeForE2E(setColorMode);
  }, [setColorMode]);

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
