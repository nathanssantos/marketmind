# Version Management

## Single Source of Truth

All version references in the MarketMind project are centralized in `package.json` to ensure consistency and ease of maintenance.

## Usage

### In TypeScript/JavaScript Code

Import the version from the shared constants:

```typescript
import { APP_VERSION, APP_NAME, APP_DESCRIPTION, APP_AUTHOR } from '@shared/constants';

// Use in your code
console.log(`${APP_NAME} v${APP_VERSION}`);
```

### In React Components

```tsx
import { APP_VERSION } from '@shared/constants';

export const AboutTab = () => {
  const { t } = useTranslation();
  
  return (
    <Text>
      {t('about.version', { version: APP_VERSION })}
    </Text>
  );
};
```

### In Tests

For tests that need to mock version information:

```typescript
import packageJson from '../../package.json';

const mockElectron = {
  app: {
    getVersion: vi.fn(() => packageJson.version),
  },
};
```

## Updating the Version

To update the project version:

1. Edit `package.json`:
   ```json
   {
     "version": "0.23.0"
   }
   ```

2. All references will automatically use the new version:
   - `src/shared/constants/app.ts` (via import)
   - `src/renderer/components/Settings/AboutTab.tsx`
   - `src/tests/setup.browser.ts`
   - Any other file importing from `@shared/constants`

3. Update documentation manually:
   - `README.md` badges
   - `CHANGELOG.md` version entries
   - `.github/copilot-instructions.md` project version

## Files Using APP_VERSION

- **Source of Truth**: `package.json`
- **Export**: `src/shared/constants/app.ts`
- **Consumers**:
  - `src/renderer/components/Settings/AboutTab.tsx`
  - `src/tests/setup.browser.ts`
  - Any component importing from `@shared/constants`

## Benefits

- ✅ Single source of truth reduces inconsistencies
- ✅ Easier version bumps (one place to update)
- ✅ Type-safe version access in TypeScript
- ✅ Automatic propagation to all code references
- ✅ Reduced risk of outdated version strings

## Migration Notes

Previously, version numbers were hardcoded in multiple places:
- `AboutTab.tsx` had `'0.21.0'`
- `setup.browser.ts` had `'0.23.0'`
- README.md badges were manually updated

Now all code references import from `package.json` via `@shared/constants`.
