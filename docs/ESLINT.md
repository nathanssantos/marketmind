# ESLint and Code Quality Configuration

## Overview

This project uses ESLint, Prettier, and TypeScript to maintain code quality and consistency.

## Tools

### ESLint
- Catches bugs and enforces code patterns
- TypeScript-aware linting
- React-specific rules
- Custom rules for project standards

### Prettier
- Automatic code formatting
- Consistent style across the codebase
- Integrated with ESLint

### TypeScript
- Strict type checking
- No `any` allowed
- Comprehensive compiler options

## Key Rules

### TypeScript
- **No `any` types**: Always use proper types
- **Explicit return types**: Functions should declare return types
- **Consistent imports**: Use `import type` for type-only imports
- **No unused variables**: All variables must be used

### Code Quality
- **No magic numbers**: Extract to constants
- **Max function length**: 150 lines
- **Max complexity**: 15 (cyclomatic complexity)
- **Max depth**: 4 levels of nesting
- **Early returns**: Prefer over nested ifs

### React
- **No React in scope**: Not needed in React 19
- **Hooks rules**: Follow hooks conventions
- **Component exports**: Warn about non-component exports

## Commands

```bash
# Run linter
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Type check
npm run type-check

# Format code
npx prettier --write .
```

## VS Code Integration

### Recommended Extensions
- ESLint
- Prettier
- Error Lens
- Code Spell Checker

### Auto-fix on Save
The project is configured to:
- Format code on save (Prettier)
- Fix ESLint issues on save
- Organize imports automatically

## Configuration Files

- `.eslintrc.json` - ESLint configuration
- `.prettierrc.json` - Prettier configuration
- `tsconfig.json` - TypeScript configuration
- `.vscode/settings.json` - VS Code settings

## Custom Rules

### Magic Numbers
```typescript
// ❌ Bad
if (klines.length > 100) { }

// ✅ Good
const MAX_KLINES = 100;
if (klines.length > MAX_KLINES) { }
```

### Type Imports
```typescript
// ❌ Bad
import { Kline } from '@shared/types';

// ✅ Good
import type { Kline } from '@shared/types';
```

### Early Returns
```typescript
// ❌ Bad (flagged by complexity rule)
function process(data: Data | null) {
  if (data) {
    if (data.valid) {
      if (data.value > 0) {
        return data.value;
      }
    }
  }
  return 0;
}

// ✅ Good
function process(data: Data | null): number {
  if (!data) return 0;
  if (!data.valid) return 0;
  if (data.value <= 0) return 0;
  
  return data.value;
}
```

## Ignoring Rules

Only when absolutely necessary:

```typescript
// Disable for one line
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = oldLibrary();

// Disable for file (avoid!)
/* eslint-disable @typescript-eslint/no-explicit-any */
```

## Pre-commit Checks

Lint and type-check are automatically run:
- Before commits (via git hooks)
- In CI/CD pipeline
- On pull requests

## Troubleshooting

### ESLint not working
```bash
# Reinstall dependencies
npm install

# Restart VS Code
# Cmd+Shift+P → "Reload Window"
```

### Type errors
```bash
# Clear TypeScript cache
rm -rf node_modules/.cache

# Rebuild
npm run type-check
```

### Prettier conflicts
```bash
# Check for conflicts
npx eslint-config-prettier .eslintrc.json
```

## References

- [ESLint Rules](https://eslint.org/docs/rules/)
- [TypeScript ESLint](https://typescript-eslint.io/rules/)
- [Prettier Options](https://prettier.io/docs/en/options.html)
