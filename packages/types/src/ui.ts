/**
 * Shared UI primitives — type-only.
 *
 * Lives in @marketmind/types (instead of @marketmind/ui) so renderer
 * components, primitive wrappers, and any future consumer can extend
 * the same base without circular workspace deps.
 */

/**
 * Base props every dialog component accepts: open/close control.
 *
 * Per-dialog interfaces should `extends DialogControlProps` instead of
 * redeclaring `isOpen` / `onClose` in every file. Dialogs that consume
 * the underlying Chakra `onOpenChange(open: boolean)` instead of a
 * close-only callback (e.g. <ChartCloseDialog>) do not extend this —
 * they're a distinct shape.
 *
 * v1.6 Track E.2.
 */
export interface DialogControlProps {
  isOpen: boolean;
  onClose: () => void;
}
