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
  },
});

export const system = createSystem(defaultConfig, config);

export * from './tokens';
export * from './semanticTokens';
export * from './recipes';
export * from './colorResolvers';
export * from './chartIndicatorTokens';
