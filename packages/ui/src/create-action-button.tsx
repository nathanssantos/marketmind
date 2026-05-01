import type { ReactNode } from 'react';
import { LuPlus } from 'react-icons/lu';
import { Button } from '@marketmind/ui';

export interface CreateActionButtonProps {
  /** Visible verb + entity, e.g. "Create wallet", "Add watcher", "Import profile". */
  label: string;
  /** Click handler — typically `disclosure.open` from `useDisclosure`. */
  onClick: () => void;
  /** Replace the default `<LuPlus />` icon (e.g. `<LuUpload />` for "Import"). */
  icon?: ReactNode;
  /** Disable the trigger (e.g. when prerequisites aren't met). */
  disabled?: boolean;
  /** Test id for e2e selectors. */
  'data-testid'?: string;
}

/**
 * Standardized trigger button for creation/add/import flows.
 *
 * Pairs with `<DialogShell>` and the dedicated creation dialog. Lives
 * inside the "manage list" surface (panel header, list section header,
 * settings tab header) and opens the dedicated dialog on click.
 *
 * Convention (per `docs/UI_DESIGN_SYSTEM.md` §Creation flows):
 * - Top-right of the list section that owns the entity
 * - `size="sm"`, outlined variant, default `<LuPlus />` icon
 * - Label is verb + entity, sentence-case ("Create wallet", "Add
 *   watcher", "Import profile") — matches the dialog title 1:1
 *
 * v1.6 — companion to the creation-dialog trigger pattern.
 */
export const CreateActionButton = ({
  label,
  onClick,
  icon,
  disabled = false,
  'data-testid': testId,
}: CreateActionButtonProps) => (
  <Button
    size="sm"
    variant="outline"
    onClick={onClick}
    disabled={disabled}
    data-testid={testId}
  >
    {icon ?? <LuPlus />}
    {label}
  </Button>
);
