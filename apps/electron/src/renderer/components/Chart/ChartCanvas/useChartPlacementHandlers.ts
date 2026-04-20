import type { MutableRefObject, RefObject } from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { BackendExecution } from '../useOrderLinesRenderer';
import type { OptimisticOverride } from './useChartTradingData';
import type { CursorManager } from './useChartState';

export interface UseChartPlacementHandlersProps {
  manager: CanvasManager | null;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  allExecutions: BackendExecution[];
  backendWalletId: string | undefined;
  symbol?: string;
  slTpPlacement: {
    active: boolean;
    type: 'stopLoss' | 'takeProfit' | null;
    executionId: string | null;
    activate: (type: 'stopLoss' | 'takeProfit', executionId: string) => void;
    deactivate: () => void;
    updatePreviewPrice: (price: number) => void;
  };
  tsPlacementActive: boolean;
  tsPlacementDeactivate: () => void;
  tsPlacementSetPreview: (price: number | null) => void;
  cursorManager: CursorManager;
  getSlTpButtonAtPosition: (x: number, y: number) => { type: 'stopLoss' | 'takeProfit'; executionId: string } | null;
  applyOptimistic: (id: string, patches: OptimisticOverride['patches'], previousValues: OptimisticOverride['previousValues']) => void;
  orderLoadingMapRef: MutableRefObject<Map<string, number>>;
  handleUpdateOrder: (id: string, updates: Record<string, unknown>) => void;
  updateTsConfig: { mutate: (input: never) => void };
  warning: (title: string, description?: string) => void;
  handleCanvasMouseMove: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasMouseDown: (event: React.MouseEvent<HTMLCanvasElement>) => void;
}

export interface UseChartPlacementHandlersResult {
  handleCanvasMouseMoveWrapped: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasMouseDownWrapped: (event: React.MouseEvent<HTMLCanvasElement>) => void;
}

export const useChartPlacementHandlers = ({
  manager,
  canvasRef,
  allExecutions,
  backendWalletId,
  symbol,
  slTpPlacement,
  tsPlacementActive,
  tsPlacementDeactivate,
  tsPlacementSetPreview,
  cursorManager,
  getSlTpButtonAtPosition,
  applyOptimistic,
  orderLoadingMapRef,
  handleUpdateOrder,
  updateTsConfig,
  warning,
  handleCanvasMouseMove,
  handleCanvasMouseDown,
}: UseChartPlacementHandlersProps): UseChartPlacementHandlersResult => {
  const { t } = useTranslation();

  const handleCanvasMouseMoveWrapped = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (slTpPlacement.active && manager && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseY = event.clientY - rect.top;
      slTpPlacement.updatePreviewPrice(manager.yToPrice(mouseY));
      manager.markDirty('overlays');
      cursorManager.setCursor('crosshair');
    }

    if (tsPlacementActive && manager && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseY = event.clientY - rect.top;
      tsPlacementSetPreview(manager.yToPrice(mouseY));
      manager.markDirty('overlays');
      cursorManager.setCursor('crosshair');
    }

    handleCanvasMouseMove(event);

    if (!slTpPlacement.active && !tsPlacementActive && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      if (getSlTpButtonAtPosition(mouseX, mouseY)) {
        cursorManager.setCursor('pointer');
      }
    }
  }, [handleCanvasMouseMove, slTpPlacement, tsPlacementActive, tsPlacementSetPreview, manager, cursorManager, getSlTpButtonAtPosition, canvasRef]);

  const handleCanvasMouseDownWrapped = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!manager || !canvasRef.current) {
      handleCanvasMouseDown(event);
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const slTpButton = getSlTpButtonAtPosition(mouseX, mouseY);
    if (slTpButton) {
      slTpPlacement.activate(slTpButton.type, slTpButton.executionId);
      event.preventDefault();
      return;
    }

    if (slTpPlacement.active && slTpPlacement.executionId) {
      const price = manager.yToPrice(mouseY);
      const execId = slTpPlacement.executionId;
      const placementType = slTpPlacement.type;
      slTpPlacement.deactivate();

      const exec = allExecutions.find(e => e.id === execId);
      const patchField = placementType === 'stopLoss' ? 'stopLoss' : 'takeProfit';
      const priceStr = price.toString();
      const patches = { [patchField]: priceStr } as OptimisticOverride['patches'];
      const prevValues = { [patchField]: exec?.[patchField] } as OptimisticOverride['previousValues'];
      applyOptimistic(execId, patches, prevValues);
      orderLoadingMapRef.current.set(execId, Date.now());

      const updatePayload: { stopLoss?: number; takeProfit?: number } = {};
      if (placementType === 'stopLoss') updatePayload.stopLoss = price;
      else updatePayload.takeProfit = price;

      handleUpdateOrder(execId, updatePayload as Record<string, unknown>);

      event.preventDefault();
      return;
    }

    if (tsPlacementActive) {
      const price = manager.yToPrice(mouseY);
      tsPlacementDeactivate();

      const openExecs = allExecutions.filter(e => e.status === 'open');
      if (openExecs.length === 0) {
        warning(t('positionTrailingStop.noPositionForPlacement'));
        event.preventDefault();
        return;
      }

      const sumByDir = new Map<string, { totalValue: number; totalQty: number }>();
      for (const ex of openExecs) {
        const entry = parseFloat(ex.entryPrice);
        const qty = parseFloat(ex.quantity);
        const prev = sumByDir.get(ex.side) ?? { totalValue: 0, totalQty: 0 };
        sumByDir.set(ex.side, { totalValue: prev.totalValue + entry * qty, totalQty: prev.totalQty + qty });
      }
      const avgEntryByDir = new Map<string, number>();
      for (const [side, { totalValue, totalQty }] of sumByDir) {
        if (totalQty > 0) avgEntryByDir.set(side, totalValue / totalQty);
      }

      const longEntry = avgEntryByDir.get('LONG');
      const shortEntry = avgEntryByDir.get('SHORT');
      const updateFields: Record<string, unknown> = { useIndividualConfig: true, trailingStopEnabled: true };

      if (longEntry && price > longEntry) {
        updateFields['trailingActivationPercentLong'] = (price / longEntry).toString();
        updateFields['trailingActivationModeLong'] = 'manual';
      } else if (shortEntry && price < shortEntry) {
        updateFields['trailingActivationPercentShort'] = (price / shortEntry).toString();
        updateFields['trailingActivationModeShort'] = 'manual';
      } else if (longEntry) {
        updateFields['trailingActivationPercentLong'] = (price / longEntry).toString();
        updateFields['trailingActivationModeLong'] = 'manual';
      } else if (shortEntry) {
        updateFields['trailingActivationPercentShort'] = (price / shortEntry).toString();
        updateFields['trailingActivationModeShort'] = 'manual';
      }

      if (backendWalletId && symbol) {
        updateTsConfig.mutate({ walletId: backendWalletId, symbol, ...updateFields } as never);
      }

      event.preventDefault();
      return;
    }

    handleCanvasMouseDown(event);
  }, [handleCanvasMouseDown, manager, getSlTpButtonAtPosition, slTpPlacement, tsPlacementActive, tsPlacementDeactivate, allExecutions, backendWalletId, symbol, updateTsConfig, t, applyOptimistic, orderLoadingMapRef, handleUpdateOrder, warning, canvasRef]);

  return {
    handleCanvasMouseMoveWrapped,
    handleCanvasMouseDownWrapped,
  };
};
