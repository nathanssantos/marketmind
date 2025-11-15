# Project Structure

## Overview

MarketMind follows a clean architecture separating main process, renderer process, and shared code.

## Directory Structure

```
src/
├── main/                    # Electron main process
│   ├── index.ts            # Entry point, window management
│   └── preload.ts          # Bridge between main and renderer
│
├── renderer/               # React application
│   ├── App.tsx            # Root component
│   ├── index.tsx          # React entry point
│   ├── global.d.ts        # Global type declarations
│   └── theme/             # Chakra UI theme configuration
│       └── index.ts
│
└── shared/                # Code shared between processes
    ├── types/             # TypeScript type definitions
    │   ├── candle.ts      # Candle data types
    │   ├── chart.ts       # Chart configuration types
    │   └── index.ts       # Type exports
    │
    └── constants/         # Application constants
        ├── chartConfig.ts # Chart configuration constants
        └── index.ts       # Constants exports
```

## Main Process (`src/main/`)

Handles Electron-specific functionality:
- Window creation and management
- IPC communication setup
- Auto-updater integration
- Native OS integrations

## Renderer Process (`src/renderer/`)

React application for the UI:
- Chakra UI components
- Chart rendering
- AI chat interface
- State management with Zustand

## Shared (`src/shared/`)

Code used by both processes:
- Type definitions
- Constants
- Utilities

## Import Aliases

Configured in `tsconfig.json` and `vite.config.ts`:

- `@/` → `src/`
- `@shared/` → `src/shared/`
- `@renderer/` → `src/renderer/`
- `@main/` → `src/main/`

## Build Output

- `dist/` → Vite build output (renderer)
- `dist-electron/` → Electron build output (main + preload)

## Type Safety

All code follows strict TypeScript configuration:
- No `any` types allowed
- Explicit function return types
- Consistent type imports using `import type`
