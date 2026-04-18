import { Box, HStack } from '@chakra-ui/react';
import { IconButton, TooltipWrapper } from '@renderer/components/ui';
import type { Drawing, TextDrawing } from '@marketmind/chart-studies';
import { DEFAULT_LINE_WIDTH } from '@marketmind/chart-studies';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useDrawingStore, compositeKey } from '@renderer/store/drawingStore';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuBold, LuLock, LuLockOpen, LuMinus, LuTrash2, LuUnderline } from 'react-icons/lu';

const COLOR_PRESETS = ['#ffffff', '#ef4444', '#22c55e', '#2196F3', '#eab308', '#f97316', '#a855f7', '#06b6d4'] as const;
const LINE_WIDTHS = [1, 2, 3] as const;
const FONT_SIZES = [12, 14, 16, 18, 20, 24] as const;

interface DrawingToolbarProps {
  manager: CanvasManager | null;
  symbol: string;
  interval: string;
}

export const DrawingToolbar = ({ manager, symbol, interval }: DrawingToolbarProps) => {
  const { t } = useTranslation();
  const selectedDrawingId = useDrawingStore(s => s.selectedDrawingId);
  const key = compositeKey(symbol, interval);
  const drawings = useDrawingStore(s => s.drawingsByKey[key]);

  const selectedDrawing = useMemo(() => drawings?.find(d => d.id === selectedDrawingId) ?? null, [drawings, selectedDrawingId]);

  const updateDrawing = useCallback((updates: Partial<Drawing>) => {
    if (!selectedDrawingId) return;
    useDrawingStore.getState().updateDrawing(selectedDrawingId, updates);
    manager?.markDirty('overlays');
  }, [selectedDrawingId, manager]);

  const handleDelete = useCallback(() => {
    if (!selectedDrawingId) return;
    useDrawingStore.getState().deleteDrawing(selectedDrawingId, symbol, interval);
  }, [selectedDrawingId, symbol, interval]);

  const handleToggleLock = useCallback(() => {
    updateDrawing({ locked: !selectedDrawing?.locked } as Partial<Drawing>);
  }, [selectedDrawing?.locked, updateDrawing]);

  if (!selectedDrawing || !manager) return null;

  const isLocked = selectedDrawing.locked;
  const isText = selectedDrawing.type === 'text';
  const textDrawing = isText ? (selectedDrawing as TextDrawing) : null;
  const currentLineWidth = selectedDrawing.lineWidth ?? DEFAULT_LINE_WIDTH;

  return (
    <Box
      position="absolute"
      top="8px"
      left="50%"
      transform="translateX(-50%)"
      zIndex={20}
      bg="bg.panel"
      border="1px solid"
      borderColor="border"
      borderRadius="md"
      px={1.5}
      py={1}
      boxShadow="md"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <HStack gap={1}>
        {COLOR_PRESETS.map(color => (
          <TooltipWrapper key={color} label={t('chart.drawingToolbar.color', 'Color')} showArrow placement="top">
            <Box
              as="button"
              w="16px"
              h="16px"
              borderRadius="full"
              bg={color}
              border={selectedDrawing.color === color ? '2px solid' : '1px solid'}
              borderColor={selectedDrawing.color === color ? 'blue.400' : 'border'}
              cursor="pointer"
              flexShrink={0}
              onClick={() => !isLocked && updateDrawing({ color } as Partial<Drawing>)}
              opacity={isLocked ? 0.4 : 1}
            />
          </TooltipWrapper>
        ))}

        <input
          type="color"
          value={selectedDrawing.color ?? '#ffffff'}
          onChange={(e) => !isLocked && updateDrawing({ color: e.target.value } as Partial<Drawing>)}
          disabled={isLocked}
          style={{ width: '20px', height: '20px', padding: 0, border: 'none', cursor: isLocked ? 'not-allowed' : 'pointer', background: 'transparent', opacity: isLocked ? 0.4 : 1 }}
        />

        <Box w="1px" h="18px" bg="border" mx={0.5} />

        {LINE_WIDTHS.map(lw => (
          <TooltipWrapper key={lw} label={t(`chart.drawingToolbar.${lw === 1 ? 'thin' : lw === 2 ? 'medium' : 'thick'}`, lw === 1 ? 'Thin' : lw === 2 ? 'Medium' : 'Thick')} showArrow placement="top">
            <Box
              as="button"
              display="flex"
              alignItems="center"
              justifyContent="center"
              w="22px"
              h="22px"
              borderRadius="sm"
              cursor="pointer"
              bg={currentLineWidth === lw ? 'blue.500/20' : 'transparent'}
              _hover={{ bg: isLocked ? undefined : 'blue.500/10' }}
              opacity={isLocked ? 0.4 : 1}
              onClick={() => !isLocked && updateDrawing({ lineWidth: lw } as Partial<Drawing>)}
            >
              <LuMinus style={{ strokeWidth: lw + 1 }} size={14} />
            </Box>
          </TooltipWrapper>
        ))}

        {isText && textDrawing && (
          <>
            <Box w="1px" h="18px" bg="border" mx={0.5} />

            <select
              value={textDrawing.fontSize}
              onChange={(e) => !isLocked && updateDrawing({ fontSize: parseInt(e.target.value) } as Partial<Drawing>)}
              disabled={isLocked}
              style={{
                background: 'transparent',
                color: 'inherit',
                border: '1px solid var(--chakra-colors-border)',
                borderRadius: '4px',
                padding: '1px 2px',
                fontSize: '11px',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                width: '42px',
                opacity: isLocked ? 0.4 : 1,
              }}
            >
              {FONT_SIZES.map(fs => (
                <option key={fs} value={fs}>{fs}</option>
              ))}
            </select>

            <TooltipWrapper label={t('chart.drawingToolbar.bold', 'Bold')} showArrow placement="top">
              <IconButton
                size="2xs"
                variant={textDrawing.fontWeight === 'bold' ? 'solid' : 'ghost'}
                aria-label={t('chart.drawingToolbar.bold', 'Bold')}
                onClick={() => !isLocked && updateDrawing({ fontWeight: textDrawing.fontWeight === 'bold' ? 'normal' : 'bold' } as Partial<Drawing>)}
                disabled={isLocked}
              >
                <LuBold />
              </IconButton>
            </TooltipWrapper>

            <TooltipWrapper label={t('chart.drawingToolbar.underline', 'Underline')} showArrow placement="top">
              <IconButton
                size="2xs"
                variant={textDrawing.textDecoration === 'underline' ? 'solid' : 'ghost'}
                aria-label={t('chart.drawingToolbar.underline', 'Underline')}
                onClick={() => !isLocked && updateDrawing({ textDecoration: textDrawing.textDecoration === 'underline' ? 'none' : 'underline' } as Partial<Drawing>)}
                disabled={isLocked}
              >
                <LuUnderline />
              </IconButton>
            </TooltipWrapper>
          </>
        )}

        <Box w="1px" h="18px" bg="border" mx={0.5} />

        <TooltipWrapper label={t(isLocked ? 'chart.drawingToolbar.unlock' : 'chart.drawingToolbar.lock', isLocked ? 'Unlock' : 'Lock')} showArrow placement="top">
          <IconButton
            size="2xs"
            variant={isLocked ? 'solid' : 'ghost'}
            aria-label={t(isLocked ? 'chart.drawingToolbar.unlock' : 'chart.drawingToolbar.lock', isLocked ? 'Unlock' : 'Lock')}
            onClick={handleToggleLock}
          >
            {isLocked ? <LuLock /> : <LuLockOpen />}
          </IconButton>
        </TooltipWrapper>

        <TooltipWrapper label={t('chart.drawingToolbar.delete', 'Delete')} showArrow placement="top">
          <IconButton
            size="2xs"
            variant="ghost"
            colorPalette="red"
            aria-label={t('chart.drawingToolbar.delete', 'Delete')}
            onClick={handleDelete}
            disabled={isLocked}
          >
            <LuTrash2 />
          </IconButton>
        </TooltipWrapper>
      </HStack>
    </Box>
  );
};
