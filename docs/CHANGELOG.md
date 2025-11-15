# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project setup with TypeScript, Electron, React 19, and Vite 7
- Chakra UI v3 integration with theme system
- Project structure with main process, renderer process, and shared code
- Type system for candles, charts, and AI
- Constants for chart configuration (colors, dimensions)
- Electron preload script with IPC bridge
- Git hooks for branch protection
- ESLint and Prettier configuration with strict rules
- Comprehensive documentation (AI_CONTEXT.md, IMPLEMENTATION_PLAN.md)
- GitHub repository setup scripts
- Automated dependency updates
- Canvas rendering system with CanvasManager
- Coordinate system utilities (price to Y, X to index conversions)
- Drawing utilities (rectangles, lines, text, candles, grid)
- ChartCanvas component with zoom and pan support
- CandlestickRenderer for rendering candlestick charts
- GridRenderer for rendering grid and price labels
- VolumeRenderer for rendering volume bars
- Sample data generator for testing
- Working chart visualization with candlesticks, grid, and volume

### Configuration
- Vite 7.2.2 for build tooling
- React 19.2.0 with TypeScript
- Chakra UI 3.29.0 for UI components
- Electron 39.2.0 for desktop application
- Zustand 5.0.8 for state management
- Axios 1.13.2 for HTTP requests
- Date-fns 4.1.0 for date manipulation

### Development
- TypeScript 5.9.3 with strict mode enabled
- ESLint 9.39.1 with React and TypeScript plugins
- Prettier 3.6.2 for code formatting
- Git hooks to prevent direct pushes to main branch

## [0.1.0] - 2025-11-14

### Added
- Project initialization
- Repository structure and documentation
- Development environment setup

---

## Legend

- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` for vulnerability fixes
- `Configuration` for dependency version changes
- `Development` for development-only changes
