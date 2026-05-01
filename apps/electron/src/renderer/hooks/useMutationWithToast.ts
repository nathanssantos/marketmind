import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './useToast';

export interface MutationLike<TInput, TResult> {
  mutateAsync: (input: TInput) => Promise<TResult>;
  isPending?: boolean;
}

export interface UseMutationWithToastOptions<TInput, TResult> {
  /** i18n key for the success toast title. */
  successKey?: string;
  /** i18n key for the failure toast title (the underlying error message goes in the body). */
  failureKey: string;
  /** Optional values for the i18n title interpolation (passed to `t(key, values)`). */
  successValues?: Record<string, unknown>;
  failureValues?: Record<string, unknown>;
  onSuccess?: (result: TResult, input: TInput) => void;
  onError?: (err: unknown, input: TInput) => void;
}

export interface UseMutationWithToast<TInput, TResult> {
  /** Run the mutation. Returns the result on success, or `null` if it threw. */
  run: (input: TInput) => Promise<TResult | null>;
  /** Whether the mutation is currently in flight (mirrors the underlying mutation's pending state). */
  isPending: boolean;
}

/**
 * Wraps a tRPC mutation (or any mutateAsync-shaped object) with the
 * standard "try mutate / show success / catch and show failure with the
 * underlying error message" pattern that every dialog rolls by hand.
 *
 * Eliminates the 19+ `try { ... } catch (err) { toast.error(title,
 * err instanceof Error ? err.message : undefined); }` instances across
 * the renderer.
 *
 * @example
 *   const create = useMutationWithToast(trpc.wallet.createPaper.useMutation(), {
 *     successKey: 'trading.dialogs.createWallet.success',
 *     failureKey: 'trading.dialogs.createWallet.failure',
 *     onSuccess: () => { reset(); onClose(); },
 *   });
 *   await create.run({ name, currency, initialBalance });
 *
 * v1.6 Track E.4.
 */
export const useMutationWithToast = <TInput, TResult>(
  mutation: MutationLike<TInput, TResult>,
  options: UseMutationWithToastOptions<TInput, TResult>,
): UseMutationWithToast<TInput, TResult> => {
  const { t } = useTranslation();
  const toast = useToast();
  const [pendingFallback, setPendingFallback] = useState(false);

  const run = useCallback(async (input: TInput): Promise<TResult | null> => {
    setPendingFallback(true);
    try {
      const result = await mutation.mutateAsync(input);
      if (options.successKey) {
        toast.success(t(options.successKey, options.successValues ?? {}));
      }
      options.onSuccess?.(result, input);
      return result;
    } catch (err) {
      const description = err instanceof Error ? err.message : String(err);
      toast.error(t(options.failureKey, options.failureValues ?? {}), description);
      options.onError?.(err, input);
      return null;
    } finally {
      setPendingFallback(false);
    }
  }, [mutation, options, t, toast]);

  return {
    run,
    isPending: mutation.isPending ?? pendingFallback,
  };
};
