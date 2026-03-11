import { useCallback, useRef, useState } from 'react';

type PlacementType = 'stopLoss' | 'takeProfit';

interface SlTpPlacementState {
  active: boolean;
  type: PlacementType | null;
  executionId: string | null;
}

export const useSlTpPlacementMode = () => {
  const [state, setState] = useState<SlTpPlacementState>({
    active: false,
    type: null,
    executionId: null,
  });
  const previewPriceRef = useRef<number | null>(null);

  const activate = useCallback((type: PlacementType, executionId: string) => {
    setState((prev) => {
      if (prev.active && prev.type === type && prev.executionId === executionId) {
        previewPriceRef.current = null;
        return { active: false, type: null, executionId: null };
      }
      return { active: true, type, executionId };
    });
  }, []);

  const deactivate = useCallback(() => {
    previewPriceRef.current = null;
    setState({ active: false, type: null, executionId: null });
  }, []);

  const updatePreviewPrice = useCallback((price: number) => {
    previewPriceRef.current = price;
  }, []);

  return {
    ...state,
    previewPriceRef,
    activate,
    deactivate,
    updatePreviewPrice,
  };
};
