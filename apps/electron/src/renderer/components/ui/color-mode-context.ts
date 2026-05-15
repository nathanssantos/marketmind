import { createContext } from 'react';

export type ColorMode = 'light' | 'dark';

export interface ColorModeContextValue {
  colorMode: ColorMode;
  toggleColorMode: () => void;
  setColorMode: (mode: ColorMode) => void;
}

/**
 * Isolated from `color-mode.tsx` so the provider/hook can be edited
 * freely without HMR re-evaluating `createContext`. When that
 * happened, every mounted consumer (`TooltipWrapper`, etc.) held a
 * reference to the old context object while the freshly-re-rendered
 * `ColorModeProvider` was on the new object — `useContext(old)`
 * returned `undefined` and the hook threw "useColorMode must be used
 * within ColorModeProvider", caught by the ErrorBoundary as the
 * "Something went wrong" fallback. This module has no React-component
 * code, so Fast Refresh treats it as a plain dependency that doesn't
 * trigger re-evaluation when downstream files change.
 */
export const ColorModeContext = createContext<ColorModeContextValue | undefined>(undefined);
