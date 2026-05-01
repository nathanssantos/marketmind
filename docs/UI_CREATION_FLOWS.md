# Creation flows — where dialogs open from

> **Authority:** v1.6 design rule #1 ("creation lives in dedicated dialogs, never in tabs"). See also `docs/V1_6_PLAN.md` and the audit script `scripts/audit-dialog-rules.mjs`.

## The pattern

Every entity in the app that the user creates (wallets, watchers, trading profiles, screeners, indicators, custom symbols) follows the **same** trigger pattern:

1. **Manage surface owns the trigger.** Each entity has a single "manage list" surface — a panel, a settings tab, a sidebar tab, or a dedicated management dialog. That surface is where the user *sees* their existing items, and where the *create new* trigger lives.
2. **`<CreateActionButton>` is the trigger.** Standardized primitive, top-right of the list section. Renders an outlined `sm` button with `<LuPlus />` (or override icon) plus a verb-first label.
3. **`useDisclosure()` owns the open/close state.** Single hook returning `{ isOpen, open, close, toggle }`. No more inline `useState(false)`.
4. **The dedicated dialog is the surface.** Always a `<DialogShell>`-based dialog file (`<XCreateDialog>`, `<XAddDialog>`, `<XImportDialog>`).
5. **On success: close + invalidate.** Dialog calls `onClose()` then triggers a tRPC `utils.x.list.invalidate()` so the list view refreshes.

```tsx
import { CreateActionButton, DialogSection } from '@renderer/components/ui';
import { useDisclosure } from '@renderer/hooks';
import { CreateWalletDialog } from './CreateWalletDialog';

export const WalletManager = () => {
  const create = useDisclosure();

  return (
    <>
      <DialogSection
        title={t('trading.wallets.title')}
        action={
          <CreateActionButton
            label={t('trading.wallets.createWallet')}
            onClick={create.open}
            data-testid="wallet-create-trigger"
          />
        }
      >
        {/* existing wallet list */}
      </DialogSection>

      <CreateWalletDialog isOpen={create.isOpen} onClose={create.close} />
    </>
  );
};
```

That's it. Every creation flow uses this exact shape.

## Why

**Predictable for users.** "+ Create" lives in the same visual position across every entity (top-right of the section that owns it). A user who has used Wallets knows where to find Trading Profiles' create button without thinking.

**Predictable for contributors.** New entity → new `<XCreateDialog>` + new `<CreateActionButton>` in the manage surface + new `useDisclosure()`. Three primitives, zero invention.

**Composable with `<DialogShell>`.** The trigger button and the dialog state are independent — anything that wants to open the dialog (header dropdown, keyboard shortcut, deep link, MCP tool) just calls `disclosure.open()`.

**Consistent test selectors.** `data-testid` convention: `<entity>-create-trigger` for the button, `<entity>-create-dialog` for the dialog content (already on `<DialogShell>`'s structure).

## Variants

| Action | Verb | Icon | Examples |
|---|---|---|---|
| **Create** | "Create X" | `<LuPlus />` (default) | Create wallet, Create profile, Create screener |
| **Add** | "Add X" | `<LuPlus />` | Add watcher, Add indicator |
| **Import** | "Import X" | `<LuUpload />` | Import profile, Import wallet |

Verb choice convention:
- **Create** when the user defines a brand-new record from a blank form.
- **Add** when the user picks an existing thing into a list (e.g. "add this symbol as a watcher").
- **Import** when the user brings an external blob into the system (JSON paste, file upload).

## What does NOT use this pattern

- **Inline row insertions** — the "+" button inside `<FilterBuilder>` that adds another filter row, or the "+" tab in `<SymbolTabBar>`. These are *part of an editor*, not creation triggers for a top-level entity. They keep their existing inline style.
- **One-off action buttons that don't open a dialog** — refresh, save, export. Those are regular `<Button>` instances.
- **Header-level "+ New" dropdowns** — if the app ever grows a top-level "+ New" menu in the header, it can wrap multiple `disclosure.open()` calls. That's compatible — the manage-surface trigger and the header dropdown both call the same `open()`.

## How this relates to Settings reorganization (A.5)

Today, several "manage X" surfaces live as tabs inside `<SettingsDialog>`:

- `Settings → wallets` → `<WalletManager>` panel
- `Settings → tradingProfiles` → `<TradingProfilesManager>` panel
- `Settings → customSymbols` → `<CustomSymbolsTab>` panel

V1.6 A.5 will promote these out of Settings into dedicated `<XDialog>` modals (per UX rule #2: "Settings is for prefs, not records you create"). When that happens, the **trigger pattern doesn't change** — only the *parent* of the trigger does. The `<CreateActionButton>` still lives at the top of the list section; the section just sits inside a different dialog instead of a Settings tab.

That's why this pattern is documented as a load-bearing primitive *before* the Settings reorg: A.5 becomes a relocation, not a redesign.
