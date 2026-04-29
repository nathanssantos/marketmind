# UI Components Standardization Plan

> Goal: Standardize ALL UI components into `@renderer/components/ui` to prepare for future extraction into `@marketmind/ui` package. All components must follow Chakra's theming system for easy theme/palette switching.

## Status Legend
- [ ] Not started
- [x] Completed

---

## Phase 1: Create New Wrappers + ToggleIconButton

### 1.1 Create `ToggleIconButton` component
- [x] Create `ui/toggle-icon-button.tsx`
- [x] Props: `active: boolean` (controls `variant` and `colorPalette` internally)

### 1.2 Create missing passthrough wrappers
| Component | File | Status |
|-----------|------|--------|
| `Badge` | `ui/badge.tsx` | [x] |
| `CloseButton` | `ui/close-button.tsx` | [x] |
| `Link` | `ui/link.tsx` | [x] |
| `Alert` | `ui/alert.tsx` | [x] |
| `Skeleton` | `ui/skeleton.tsx` | [x] |
| `Textarea` | `ui/textarea.tsx` | [x] |
| `Menu` | `ui/menu.tsx` | [x] |
| `Image` | `ui/image.tsx` | [x] |

---

## Phase 2: Update `index.ts` with ALL exports

- [x] All components exported from barrel `index.ts`
- [x] Including: `ToggleIconButton`, `Badge`, `CloseButton`, `Link`, `Alert`, `Skeleton`, `Textarea`, `Menu`, `Image`
- [x] Including: `ErrorMessage`, `CryptoIcon`, `LoadingSpinner`, `Card`, `Stat`, `StatRow`, `Table`
- [x] Including: `ProgressRoot`, `ProgressBar`, `SidebarContainer`, `SidebarHeader`
- [x] Including: `useColorMode`, `ColorModeProvider`

---

## Phase 3: Migrate Toggle IconButtons → `ToggleIconButton`

| File | Count | Status |
|------|-------|--------|
| `Layout/ChartToolsToolbar.tsx` | 11 | [x] |
| `Layout/Toolbar.tsx` | 5 | [x] |
| `Chart/ChartControls.tsx` | 7 | [x] |
| `Layout/TrailingStopPopover.tsx` | 1 | [x] |
| `Layout/GridOrderPopover.tsx` | 1 | [x] |
| `Chart/PinnableControl.tsx` | 1 | [x] |

---

## Phase 4: Migrate Direct Chakra Imports → Custom Wrappers

- [x] Badge (~24 files)
- [x] CloseButton (3 files)
- [x] Link (2 files)
- [x] Alert (1 file)
- [x] Skeleton (1 file)
- [x] Textarea (2 files)
- [x] Menu (2 files)
- [x] Image (1 file - CryptoIcon)
- [x] IconButton (~26 files)
- [x] Progress (3 files)
- [x] Tabs (2 files)
- [x] Table (1 file)

---

## Phase 5: Decouple App Dependencies from `ui/` Components

| Task | Status |
|------|--------|
| `BrlValue.tsx`: moved to `components/` (domain component, not UI) | [x] |
| `PnLDisplay.tsx` / `MetricCard.tsx`: internal imports cleaned up | [x] |
| `ui/` internal imports: relative paths (no barrel self-reference) | [x] |

---

## Phase 6: Standardize ALL Import Paths

- [x] All `../ui/button` → `@renderer/components/ui` barrel
- [x] All `./ui/icon-button` → `@renderer/components/ui` barrel
- [x] All `@/renderer/components/ui/xyz` → `@renderer/components/ui` barrel
- [x] All relative `ui/` paths → `@renderer/components/ui` barrel
- [x] Test files updated to use barrel imports

---

## Phase 7: Remove Legacy/Obsolete Code

- [x] Removed unused individual imports
- [x] `ui/` internal files use relative imports (no circular barrel deps)
- [x] `ui/README.md` updated - no more "Chakra UI Direct Imports" for interactive components

---

## Verification Checklist

1. [x] `pnpm --filter @marketmind/electron type-check` passes (0 errors)
2. [x] `pnpm --filter @marketmind/electron lint` passes (only pre-existing errors)
3. [x] `pnpm --filter @marketmind/electron test` passes (2295 + 27 browser = 2322 tests)
4. [x] No import of interactive component directly from `@chakra-ui/react` (except inside `ui/` wrappers)
5. [x] All `ui/` components use Chakra's theming system
6. [x] `docs/UI_STYLE_GUIDE.md` updated
7. [x] `ui/README.md` updated
8. [x] `CLAUDE.md` UI section updated
