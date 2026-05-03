import { Box, Stack, Text } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { FormDialog, Input } from '@renderer/components/ui';
import { useDrawingStore } from '@renderer/store/drawingStore';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { Drawing } from '@marketmind/chart-studies';
import type { DialogControlProps } from '@marketmind/types';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DrawingPropertiesDialogProps extends DialogControlProps {
  drawing: Drawing | null;
  manager: CanvasManager | null;
}

/**
 * Generic properties dialog for drawings. Today only the horizontal-line
 * panel is wired (price level + bidirectional binding to the canvas
 * line position); other drawing kinds will get their own panels here as
 * they need richer config beyond the floating toolbar's color/width.
 *
 * The drag → input → drag round-trip is bidirectional via the Zustand
 * store: the input reflects `drawing.price` directly (via re-render
 * whenever the store updates), and committing the input writes back to
 * `updateDrawing` which re-runs the renderer. No local copy lives long
 * enough to drift.
 */
export const DrawingPropertiesDialog = ({
  isOpen,
  onClose,
  drawing,
  manager,
}: DrawingPropertiesDialogProps) => {
  const { t } = useTranslation();

  if (!drawing) return null;

  const titleKey = `chart.drawingProperties.${drawing.type}.title`;

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t(titleKey)}
      hideFooter
      size="sm"
    >
      <Stack gap={3}>
        {drawing.type === 'horizontalLine' ? (
          <HorizontalLineProperties drawing={drawing} manager={manager} onClose={onClose} />
        ) : (
          <Box>
            <Text fontSize="sm" color="fg.muted">
              {t('chart.drawingProperties.notImplemented')}
            </Text>
          </Box>
        )}
      </Stack>
    </FormDialog>
  );
};

interface HorizontalLinePropertiesProps {
  drawing: Drawing & { type: 'horizontalLine'; price: number };
  manager: CanvasManager | null;
  onClose: () => void;
}

/**
 * The price input is the source of truth while the dialog is open —
 * `value` reflects whatever the user is typing. Commit on blur or
 * Enter writes to the store; the canvas re-renders from the new
 * store value. Cancel just closes (no destructive backout needed
 * since we only commit on explicit action).
 */
const HorizontalLineProperties = ({ drawing, manager, onClose }: HorizontalLinePropertiesProps) => {
  const { t } = useTranslation();
  const [priceInput, setPriceInput] = useState(String(drawing.price));

  // Sync the input with the store whenever the underlying price moves
  // (e.g. user dragged the line while the dialog was open). Without
  // this the input would freeze at its initial value even though the
  // line moved underneath.
  useEffect(() => {
    setPriceInput(String(drawing.price));
  }, [drawing.price]);

  const commit = useCallback(() => {
    const parsed = parseFloat(priceInput);
    if (!Number.isFinite(parsed)) {
      setPriceInput(String(drawing.price));
      return;
    }
    if (parsed === drawing.price) return;
    useDrawingStore.getState().updateDrawing(drawing.id, { price: parsed });
    manager?.markDirty('overlays');
  }, [priceInput, drawing.id, drawing.price, manager]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commit();
        onClose();
      }
    },
    [commit, onClose],
  );

  return (
    <ChakraField.Root>
      <ChakraField.Label fontSize="xs" color="fg.muted">
        {t('chart.drawingProperties.horizontalLine.price')}
      </ChakraField.Label>
      <Input
        type="number"
        step="any"
        value={priceInput}
        onChange={(e) => setPriceInput(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        autoFocus
      />
    </ChakraField.Root>
  );
};
