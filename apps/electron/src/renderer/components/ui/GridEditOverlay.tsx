import { Box } from '@chakra-ui/react';
import { IconButton, TooltipWrapper } from '@renderer/components/ui';
import { memo, type MouseEvent as ReactMouseEvent, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LuTrash2 } from 'react-icons/lu';

interface GridEditOverlayProps {
  /** Panel id passed back to onClose so the caller can identify which panel was closed. */
  panelId: string;
  onClose: (panelId: string) => void;
}

/**
 * v1.5 — translucent scrim rendered over each panel while the grid
 * edit mode is on. The whole overlay carries the `panel-drag-handle`
 * class, so react-grid-layout treats a click anywhere on the panel
 * surface as a drag start. The center delete button stops mousedown
 * from propagating so its click doesn't kick off a drag.
 *
 * The overlay sits at zIndex 100 to clear any inner panel chrome
 * (chart-panel pagination buttons, header min/max, etc.) — the user
 * is editing the grid, not the panel content.
 *
 * The delete affordance is centered (rather than corner-pinned) and
 * uses `LuTrash2` so it reads as "delete this panel" — the corner X
 * pattern was conflicting visually with the resize handle hot zones
 * at every panel border.
 */
export const GridEditOverlay = memo(({ panelId, onClose }: GridEditOverlayProps) => {
  const { t } = useTranslation();

  const handleClose = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      onClose(panelId);
    },
    [onClose, panelId],
  );

  const stopMouseDown = useCallback((e: ReactMouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <Box
      className="panel-drag-handle"
      position="absolute"
      inset={0}
      bg="blackAlpha.600"
      backdropFilter="auto"
      backdropBlur="2px"
      zIndex={100}
      cursor="grab"
      _active={{ cursor: 'grabbing' }}
      data-testid={`grid-edit-overlay-${panelId}`}
    >
      <TooltipWrapper label={t('panels.deletePanel', { defaultValue: 'Delete panel' })} showArrow>
        <IconButton
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          size="md"
          variant="ghost"
          colorPalette="red"
          aria-label={t('panels.deletePanel', { defaultValue: 'Delete panel' })}
          onMouseDown={stopMouseDown}
          onClick={handleClose}
          data-testid={`grid-edit-close-${panelId}`}
        >
          <LuTrash2 />
        </IconButton>
      </TooltipWrapper>
    </Box>
  );
});

GridEditOverlay.displayName = 'GridEditOverlay';
