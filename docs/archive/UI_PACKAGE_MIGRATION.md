# `@marketmind/ui` extraction plan

> Status: **audit only** (Phase 2.2 of `docs/archive/V1_POST_RELEASE_PLAN.md`).
> Actual extraction is v1.2 work.

## Why extract

- Reuse the `ui/` primitives in:
  - `marketmind-site` (landing page) — same Chakra v3 design language
  - Future thin-clients (browser-only mode, mobile) without bundling the full Electron renderer
  - Storybook / design-system docs site
- Decouple the UI layer from the Electron renderer's tRPC + Zustand layer
- Single-source design tokens (already established in v1.1 Phase 2.1)

## Audit results

The renderer's `ui/` directory is mostly clean — only **3 files** carry cross-imports outside the ui boundary.

### Clean (53 files — extract as-is in v1.2)

These files have no cross-imports beyond `@chakra-ui/react`, `react-icons/lu`, and other ui/ siblings:

| Status | File |
|---|---|
| ✅ | `alert.tsx` |
| ✅ | `badge.tsx` |
| ✅ | `beta-badge.tsx` |
| ✅ | `button.tsx` |
| ✅ | `callout.tsx` (new in v1.0.0) |
| ✅ | `card.tsx` |
| ✅ | `checkbox.tsx` |
| ✅ | `close-button.tsx` |
| ✅ | `color-picker.tsx` |
| ✅ | `CollapsibleSection.tsx` |
| ✅ | `ConfirmationDialog.tsx` |
| ✅ | `CryptoIcon.tsx` |
| ✅ | `dialog.tsx` |
| ✅ | `DirectionModeSelector.tsx` |
| ✅ | `EmptyState.tsx` |
| ✅ | `ErrorMessage.tsx` |
| ✅ | `field.tsx` |
| ✅ | `form-section.tsx` (new in v1.0.0) |
| ✅ | `FormDialog.tsx` |
| ✅ | `GridWindow.tsx` |
| ✅ | `icon-button.tsx` |
| ✅ | `image.tsx` |
| ✅ | `input.tsx` |
| ✅ | `link.tsx` |
| ✅ | `LoadingSpinner.tsx` |
| ✅ | `logo.tsx` |
| ✅ | `menu.tsx` |
| ✅ | `number-input.tsx` |
| ✅ | `password-input.tsx` |
| ✅ | `popover.tsx` |
| ✅ | `progress.tsx` |
| ✅ | `radio.tsx` |
| ✅ | `select.tsx` |
| ✅ | `separator.tsx` |
| ✅ | `Sidebar.tsx` |
| ✅ | `skeleton.tsx` |
| ✅ | `slider.tsx` |
| ✅ | `Stat.tsx` |
| ✅ | `switch.tsx` |
| ✅ | `Table.tsx` |
| ✅ | `tabs.tsx` |
| ✅ | `textarea.tsx` |
| ✅ | `toggle-icon-button.tsx` |
| ✅ | `Tooltip.tsx` |
| ✅ | `typography.tsx` (new in v1.0.0) |

### Coupled (3 files — needs surgery before extraction)

#### `color-mode.tsx`
**Cross-import:** `import { QUERY_CONFIG } from '@shared/constants'`

**Plan**: inline the single constant used (likely a stale-time value) at the call site, or accept it as a prop on the provider. The `@shared/constants` module is renderer-bound and shouldn't follow the package.

**Effort**: 15 min

#### `MetricCard.tsx` / `PnLDisplay.tsx`
**Cross-import:** `import { getPnLColor } from '@/renderer/theme'`

**Plan**: `getPnLColor` is a thin helper that maps a numeric P&L to a semantic color. Move it into a `@marketmind/ui/utils` module (or accept as a prop). Color resolvers logic that depends on chart palettes stays in the renderer.

**Effort**: 30 min (write tiny `pnlColor.ts` in package; update 2 call sites)

### Tokens (Phase 2.1 — already done)

The `theme/tokens.ts` (`MM` constant) is consumed by `Callout`, `FormSection`, `FormRow`, `typography`. Tokens are pure TS, no Chakra dependency at the value level — they go to the package alongside the primitives without surgery.

## Migration order (when v1.2 starts)

1. **Set up `packages/ui/` workspace** (`package.json`, `tsconfig.json`, build via `tsup`)
2. **Move tokens first** — `theme/tokens.ts` → `packages/ui/src/tokens.ts`
3. **Move clean primitives** — 44 files in batches (typography, simple atoms, then composites)
4. **Surgery on the 3 coupled files**:
   - `color-mode.tsx` — inline constant
   - `MetricCard.tsx`, `PnLDisplay.tsx` — bring `getPnLColor` along, update imports
5. **Update renderer imports** — `@renderer/components/ui` → `@marketmind/ui` (single search/replace; the barrel covers everything)
6. **Add Storybook** in the package (optional but high-value)
7. **Publish to private registry** — for `marketmind-site` consumption

## Out of scope for the audit

- Test files in `ui/` (`callout.test.tsx`, `form-section.test.tsx`, etc.) — these test only the primitives, so they move alongside in v1.2
- The handful of `recipes.ts` / `semanticTokens.ts` / `colorResolvers.ts` files in `theme/` — these go to the package's `theme/` subdir
- App-specific colors (chart palettes, trading direction colors) — stay in the renderer's `theme/`

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Renderer accidentally re-couples after extraction | High | ESLint rule banning `@renderer/*` imports from `@marketmind/ui` package |
| Chakra v3 minor version drift between repos | Med | Single source-of-truth peer-dep range pinned in package.json |
| Storybook setup blocks v1.2 release | Med | Storybook is optional in the migration order; can defer to v1.3 |
| Site repo can't consume scoped private package | Low | Use pnpm workspaces (already used for monorepo); site joins as workspace member |

## Conclusion

Extraction is **low-effort** — only 3 coupled files, ~45 minutes of surgery. The bulk is mechanical (move + rewrite imports). Recommend executing in v1.2 as the first PR after v1.1 ships.
