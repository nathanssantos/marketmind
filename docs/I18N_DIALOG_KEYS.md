# Dialog i18n key convention

> **Authority:** v1.6 Track E.5. CI gate: `scripts/audit-dialog-i18n-keys.mjs`.

Every dialog-scoped translation key follows the shape:

```
<feature>.dialogs.<dialogName>.<key>
```

Where `<key>` is one of a fixed enum:

| Key | Purpose |
|---|---|
| `title` | Dialog title (required for every dialog) |
| `description` | Optional one-line description below the title |
| `submit` | Primary CTA verb (e.g. "Create", "Save", "Import") |
| `cancel` | Secondary CTA verb. **Rarely overridden** — defaults to `common.cancel` if absent. |
| `field.<fieldName>.label` | Field label |
| `field.<fieldName>.helper` | Field helper text below the input |
| `field.<fieldName>.placeholder` | Input placeholder |
| `field.<fieldName>.error` | Field-specific validation error |
| `section.<sectionName>.title` | Section heading inside the dialog body |
| `section.<sectionName>.description` | Section helper text |
| `success` | Toast title shown after a successful mutation |
| `failure` | Toast title shown when a mutation fails (the underlying error message goes in the toast body) |
| `confirm.title` | Title for the confirmation dialog spawned for destructive actions |
| `confirm.body` | Body of that confirmation dialog |
| `confirm.cta` | Primary action label for that confirmation dialog |

Anything else under a `dialogs.<dialogName>.*` subtree is a violation.

## Why

Predictable shape lets:
- The shared `<DialogShell>` primitive read titles/descriptions from a single base key.
- The `useMutationWithToast` hook resolve `successKey` / `failureKey` automatically from the dialog's namespace.
- Translators see exactly what's needed per dialog without spelunking the JSON.
- CI catch drift (typos, missing translations, dialogs that exist in pt but not en).

## Example

```jsonc
// apps/electron/src/renderer/locales/en/translation.json
{
  "trading": {
    "dialogs": {
      "createWallet": {
        "title": "Create wallet",
        "description": "Add a paper, testnet, or live trading wallet.",
        "submit": "Create",
        "field": {
          "name":           { "label": "Name", "placeholder": "My main wallet" },
          "exchange":       { "label": "Exchange" },
          "initialBalance": { "label": "Initial balance", "helper": "Used as the starting paper-trading balance." }
        },
        "section": {
          "credentials": { "title": "API credentials", "description": "Read-only. Never stored on our servers." }
        },
        "success": "Wallet created",
        "failure": "Could not create wallet"
      }
    }
  }
}
```

`pt`, `es`, and `fr` mirror the **exact same key set**, only the values differ. The audit script enforces that 1:1 mapping per dialog.

## CI

`scripts/audit-dialog-i18n-keys.mjs` walks every locale's JSON and reports:

- **`forbidden-leaf`** — a key under `dialogs.<dialog>.*` that's not in the allowed enum.
- **`missing-translation`** — a key exists in `en` but not in another locale.
- **`extra-translation`** — a key exists in another locale but not in `en`.
- **`extra-dialog`** — a `dialogs.<dialog>` subtree exists in another locale but not in `en`.

The script ships passing — at the moment of E.5 (this PR) no dialog has been migrated to the convention, so there's nothing under any `dialogs.*` subtree yet. As Track A dialog rewrites land, more subtrees show up and get checked automatically.

## Migration

When a dialog gets rewritten under Track A:
1. Move every visible string into `<feature>.dialogs.<dialogName>.*` per the shape above.
2. Delete the old keys.
3. Update `en` first (canonical), then mirror the structure to `pt/es/fr`.
4. Run `node scripts/audit-dialog-i18n-keys.mjs` — should report clean.
5. The dialog itself imports nothing new for i18n; just calls `t(...)` with the new keys.

## Strictness

The CI gate (`pnpm lint:audit:dialog-i18n` once wired) defaults to `--strict` mode (exit 1 on any violation). To inspect issues without failing during local development:

```bash
node scripts/audit-dialog-i18n-keys.mjs --list
```
