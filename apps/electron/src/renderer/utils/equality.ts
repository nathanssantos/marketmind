/**
 * One-level structural equality. Returns true if `a` and `b` have the
 * same set of own enumerable keys AND each value compares strict-equal
 * (`===`). Intentionally NOT recursive — keep callers in control of
 * what "equal" means at deeper levels.
 *
 * Strict-equal short-circuit at the top so primitives, identical
 * references, and `null === null` all bail without traversing.
 *
 * Single source of truth — previously there were ad-hoc copies in
 * `useFormState` and `useLiveStream`. Use this helper everywhere.
 */
export const shallowEqual = <T>(a: T, b: T): boolean => {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if ((a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]) return false;
  }
  return true;
};
