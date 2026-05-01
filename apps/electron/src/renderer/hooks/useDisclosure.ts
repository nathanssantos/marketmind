import { useCallback, useState } from 'react';

export interface UseDisclosure {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/**
 * Single source of truth for an open/close pair. Replaces the ~15
 * `const [isOpen, setIsOpen] = useState(false)` snippets scattered
 * across the renderer.
 *
 * Designed to pair cleanly with the v1.6 dialog primitives:
 *
 *   const create = useDisclosure();
 *   <CreateActionButton onClick={create.open} label="Create wallet" />
 *   <CreateWalletDialog isOpen={create.isOpen} onClose={create.close} />
 *
 * v1.6 — companion to the creation-dialog trigger pattern.
 */
export const useDisclosure = (defaultOpen = false): UseDisclosure => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  return { isOpen, open, close, toggle };
};
