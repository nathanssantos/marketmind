/**
 * Encoded "close target" strings the chart passes to handleConfirmCloseOrder.
 * Documented as one place so renderer + handler share a single grammar.
 *
 * - `null`              → modal request to close (no-op for handler)
 * - `'ts-disable'`      → disable trailing stop for the active wallet/symbol
 * - `'sltp:<type>:<execId1>,<execId2>,...'`
 *                       → cancel SL or TP across N executions of one position
 * - `'exchange-order-<binanceOrderId>'`   → cancel a manual exchange LIMIT
 * - `'exchange-algo-<binanceAlgoId>'`     → cancel a manual exchange ALGO
 * - `<execId>`          → cancel pending exec OR open the close-position modal
 */

export type CloseTarget =
  | { kind: 'modal-clear' }
  | { kind: 'ts-disable' }
  | { kind: 'sltp'; sltpType: 'stopLoss' | 'takeProfit'; executionIds: string[] }
  | { kind: 'exchange'; isAlgo: boolean; exchangeOrderId: string; rawId: string }
  | { kind: 'execution'; executionId: string };

export const parseCloseTarget = (id: string | null): CloseTarget => {
  if (!id) return { kind: 'modal-clear' };
  if (id === 'ts-disable') return { kind: 'ts-disable' };

  if (id.startsWith('sltp:')) {
    const firstColon = id.indexOf(':');
    const secondColon = id.indexOf(':', firstColon + 1);
    if (secondColon === -1) {
      return { kind: 'sltp', sltpType: 'stopLoss', executionIds: [] };
    }
    const sltpType = id.substring(firstColon + 1, secondColon) as 'stopLoss' | 'takeProfit';
    const executionIds = id.substring(secondColon + 1).split(',').filter(Boolean);
    return { kind: 'sltp', sltpType, executionIds };
  }

  if (id.startsWith('exchange-order-') || id.startsWith('exchange-algo-')) {
    const isAlgo = id.startsWith('exchange-algo-');
    const exchangeOrderId = id.replace(/^exchange-(order|algo)-/, '');
    return { kind: 'exchange', isAlgo, exchangeOrderId, rawId: id };
  }

  return { kind: 'execution', executionId: id };
};

/**
 * Inverse of parseCloseTarget for the SL/TP case — used by the renderer to
 * encode a click on a SL or TP price line into a target string.
 */
export const encodeSltpTarget = (
  sltpType: 'stopLoss' | 'takeProfit',
  executionIds: string[],
): string => `sltp:${sltpType}:${executionIds.join(',')}`;
