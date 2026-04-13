import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';
import { badgeRecipe, collapsibleSectionRecipe, filterToggleRecipe } from './recipes';
import { semanticTokenColors } from './semanticTokens';

const customConfig = defineConfig({
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

export const system = createSystem(defaultConfig, customConfig);

export { badgeRecipe, collapsibleSectionRecipe, filterToggleRecipe } from './recipes';
export { getChartColors, getTradingColors, getCanvasColors, getPnLColor, getSideColor } from './colorResolvers';
