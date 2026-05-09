import { Box } from '@chakra-ui/react';
import { IconButton, TooltipWrapper } from '@renderer/components/ui';
import { memo, type MouseEvent as ReactMouseEvent, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';

interface GridEditOverlayProps {
  /** Panel id passed back to onClose so the caller can identify which panel was closed. */
  panelId: string;
  onClose: (panelId: string) => void;
}

export const GridEditOverlay = memo(({ panelId, onClose }: GridEditOverlayProps) => {
  const { t } = useTranslation();

  const handleClose = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      onClose(panelId);
    },
    [onClose, panelId],
  );

  const handleSwallowMouseDown = useCallback((e: ReactMouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <Box
      position="absolute"
      inset={0}
      bg="blackAlpha.500"
      backdropFilter="auto"
      backdropBlur="2px"
      zIndex={2}
      pointerEvents="auto"
      onMouseDown={handleSwallowMouseDown}
      data-testid={`grid-edit-overlay-${panelId}`}
    >
      <TooltipWrapper label={t('common.close')} showArrow>
        <IconButton
          position="absolute"
          top={2}
          right={2}
          size="xs"
          variant="solid"
          colorPalette="red"
          aria-label={t('common.close')}
          onClick={handleClose}
          data-testid={`grid-edit-close-${panelId}`}
        >
          <LuX />
        </IconButton>
      </TooltipWrapper>
    </Box>
  );
});

GridEditOverlay.displayName = 'GridEditOverlay';
