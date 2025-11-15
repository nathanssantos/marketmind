import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const customConfig = defineConfig({
  theme: {
    semanticTokens: {
      colors: {
        'bg.panel': {
          value: {
            base: '#ffffff',
            _dark: '#1a202c',
          },
        },
        'bg.surface': {
          value: {
            base: '#f7fafc',
            _dark: '#2d3748',
          },
        },
        'bg.muted': {
          value: {
            base: '#edf2f7',
            _dark: '#4a5568',
          },
        },
        border: {
          value: {
            base: '#e2e8f0',
            _dark: '#4a5568',
          },
        },
        fg: {
          value: {
            base: '#1a202c',
            _dark: '#f7fafc',
          },
        },
        'fg.muted': {
          value: {
            base: '#718096',
            _dark: '#a0aec0',
          },
        },
      },
    },
  },
  globalCss: {
    body: {
      bg: 'bg.panel',
      color: 'fg',
      userSelect: 'none',
    },
  },
});

export const system = createSystem(defaultConfig, customConfig);
