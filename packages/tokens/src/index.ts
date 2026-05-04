import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';
import { badgeRecipe, collapsibleSectionRecipe, filterToggleRecipe } from './recipes';
import { semanticTokenColors } from './semanticTokens';

export const config = defineConfig({
  theme: {
    recipes: {
      badge: badgeRecipe,
    },
    slotRecipes: {
      collapsibleSection: collapsibleSectionRecipe,
      filterToggle: filterToggleRecipe,
    },
    semanticTokens: {
      colors: semanticTokenColors,
    },
  },
  globalCss: {
    body: {
      bg: 'bg.panel',
      color: 'fg',
      userSelect: 'text',
    },
    // Recharts surfaces (`<svg class="recharts-surface">`) take focus on
    // click and the browser default outline draws a stray rectangle that
    // looks like a stuck selection ring. Disable it everywhere — focus
    // outlines on chart svgs are useless for keyboard nav anyway (Recharts
    // doesn't expose a focusable element interface).
    '.recharts-wrapper, .recharts-surface, .recharts-wrapper *:focus, .recharts-surface:focus': {
      outline: 'none',
    },
  },
});

export const system = createSystem(defaultConfig, config);

export * from './tokens';
export * from './semanticTokens';
export * from './recipes';
export * from './colorResolvers';
export * from './chartIndicatorTokens';
