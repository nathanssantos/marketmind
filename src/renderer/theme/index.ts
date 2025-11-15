import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: '#e3f2fd' },
          100: { value: '#bbdefb' },
          200: { value: '#90caf9' },
          300: { value: '#64b5f6' },
          400: { value: '#42a5f5' },
          500: { value: '#2196f3' },
          600: { value: '#1e88e5' },
          700: { value: '#1976d2' },
          800: { value: '#1565c0' },
          900: { value: '#0d47a1' },
        },
      },
    },
    semanticTokens: {
      colors: {
        'bg.panel': {
          value: {
            _light: 'white',
            _dark: 'gray.950',
          },
        },
        'bg.surface': {
          value: {
            _light: 'gray.50',
            _dark: 'gray.900',
          },
        },
        'bg.muted': {
          value: {
            _light: 'gray.100',
            _dark: 'gray.800',
          },
        },
        border: {
          value: {
            _light: 'gray.200',
            _dark: '#2d3548',
          },
        },
        fg: {
          value: {
            _light: 'gray.900',
            _dark: '#e4e7eb',
          },
        },
        'fg.muted': {
          value: {
            _light: 'gray.600',
            _dark: '#9ca3af',
          },
        },
      },
    },
  },
  globalCss: {
    'input, textarea': {
      px: '3!',
    },
    '[data-scope="select"][data-part="trigger"]': {
      px: '3!',
    },
    '[data-scope="select"][data-part="content"]': {
      bg: 'bg.panel!',
    },
    '[data-scope="badge"]': {
      px: '2!',
    },
    body: {
      userSelect: 'none',
      WebkitUserSelect: 'none',
      bg: 'bg.panel',
      color: 'fg',
    },
  },
});

export const system = createSystem(defaultConfig, config);
