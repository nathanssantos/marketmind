import { Box, HStack } from '@chakra-ui/react';
import { IconButton, TooltipWrapper } from '@renderer/components/ui';
import type { Drawing, TextDrawing } from '@marketmind/chart-studies';
import { DEFAULT_LINE_WIDTH } from '@marketmind/chart-studies';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useDrawingStore, compositeKey } from '@renderer/store/drawingStore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuBold, LuGripVertical, LuMinus, LuTrash2, LuUnderline } from 'react-icons/lu';

const COLOR_PRESETS = ['#ffffff', '#ef4444', '#22c55e', '#2196F3', '#eab308', '#f97316', '#a855f7', '#06b6d4'] as const;
const LINE_WIDTHS = [1, DEFAULT_LINE_WIDTH, 3] as const;
const FONT_SIZES = [12, 14, 16, 18, 20, 24] as const;
const TOOLBAR_OFFSET_Y = -44;

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
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const selectedDrawing = useMemo(() => drawings?.find(d => d.id === selectedDrawingId) ?? null, [drawings, selectedDrawingId]);

  const getAnchorPosition = useCallback((): { x: number; y: number } | null => {
    if (!selectedDrawing || !manager) return null;
    switch (selectedDrawing.type) {
      case 'text':
      case 'horizontalLine':
      case 'verticalLine':
      case 'anchoredVwap':
        return { x: manager.indexToCenterX(selectedDrawing.index), y: manager.priceToY(selectedDrawing.price) };
      case 'pencil':
      case 'highlighter':
        if (selectedDrawing.points.length === 0) return null;
        return { x: manager.indexToCenterX(selectedDrawing.points[0]!.index), y: manager.priceToY(selectedDrawing.points[0]!.price) };
      case 'fibonacci':
        return { x: manager.indexToCenterX(selectedDrawing.swingHighIndex), y: manager.priceToY(selectedDrawing.swingHighPrice) };
      default:
        return { x: manager.indexToCenterX(selectedDrawing.startIndex), y: manager.priceToY(selectedDrawing.startPrice) };
    }
  }, [selectedDrawing, manager]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const anchor = getAnchorPosition();
    if (!anchor) return;
    const currentX = dragOffset ? dragOffset.x : 0;
    const currentY = dragOffset ? dragOffset.y : 0;
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, originX: currentX, originY: currentY };
    setIsDragging(true);
  }, [getAnchorPosition, dragOffset]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const ds = dragState.current;
      if (!ds.dragging) return;
      setDragOffset({
        x: ds.originX + (e.clientX - ds.startX),
        y: ds.originY + (e.clientY - ds.startY),
      });
    };
    const handleMouseUp = () => {
      dragState.current.dragging = false;
      setIsDragging(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    setDragOffset(null);
  }, [selectedDrawingId]);

  const updateDrawing = useCallback((updates: Partial<Drawing>) => {
    if (!selectedDrawingId) return;
    useDrawingStore.getState().updateDrawing(selectedDrawingId, updates);
    manager?.markDirty('overlays');
  }, [selectedDrawingId, manager]);

  const handleDelete = useCallback(() => {
    if (!selectedDrawingId) return;
    useDrawingStore.getState().deleteDrawing(selectedDrawingId, symbol, interval);
  }, [selectedDrawingId, symbol, interval]);

  if (!selectedDrawing || !manager) return null;

  const anchor = getAnchorPosition();
  if (!anchor) return null;

  const x = anchor.x + (dragOffset?.x ?? 0);
  const y = anchor.y + TOOLBAR_OFFSET_Y + (dragOffset?.y ?? 0);

  const isText = selectedDrawing.type === 'text';
  const textDrawing = isText ? (selectedDrawing as TextDrawing) : null;
  const currentLineWidth = selectedDrawing.lineWidth ?? DEFAULT_LINE_WIDTH;

  return (
    <Box
      position="absolute"
      left={`${x}px`}
      top={`${y}px`}
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
        <Box
          cursor="grab"
          onMouseDown={handleDragStart}
          display="flex"
          alignItems="center"
          color="fg.muted"
          _hover={{ color: 'fg' }}
        >
          <LuGripVertical size={14} />
        </Box>

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
              onClick={() => updateDrawing({ color } as Partial<Drawing>)}
            />
          </TooltipWrapper>
        ))}

        <input
          type="color"
          value={selectedDrawing.color ?? '#ffffff'}
          onChange={(e) => updateDrawing({ color: e.target.value } as Partial<Drawing>)}
          style={{ width: '20px', height: '20px', padding: 0, border: 'none', cursor: 'pointer', background: 'transparent' }}
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
              _hover={{ bg: 'blue.500/10' }}
              onClick={() => updateDrawing({ lineWidth: lw } as Partial<Drawing>)}
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
              onChange={(e) => updateDrawing({ fontSize: parseInt(e.target.value) } as Partial<Drawing>)}
              style={{
                background: 'transparent',
                color: 'inherit',
                border: '1px solid var(--chakra-colors-border)',
                borderRadius: '4px',
                padding: '1px 2px',
                fontSize: '11px',
                cursor: 'pointer',
                width: '42px',
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
                onClick={() => updateDrawing({ fontWeight: textDrawing.fontWeight === 'bold' ? 'normal' : 'bold' } as Partial<Drawing>)}
              >
                <LuBold />
              </IconButton>
            </TooltipWrapper>

            <TooltipWrapper label={t('chart.drawingToolbar.underline', 'Underline')} showArrow placement="top">
              <IconButton
                size="2xs"
                variant={textDrawing.textDecoration === 'underline' ? 'solid' : 'ghost'}
                aria-label={t('chart.drawingToolbar.underline', 'Underline')}
                onClick={() => updateDrawing({ textDecoration: textDrawing.textDecoration === 'underline' ? 'none' : 'underline' } as Partial<Drawing>)}
              >
                <LuUnderline />
              </IconButton>
            </TooltipWrapper>
          </>
        )}

        <Box w="1px" h="18px" bg="border" mx={0.5} />

        <TooltipWrapper label={t('chart.drawingToolbar.delete', 'Delete')} showArrow placement="top">
          <IconButton
            size="2xs"
            variant="ghost"
            colorPalette="red"
            aria-label={t('chart.drawingToolbar.delete', 'Delete')}
            onClick={handleDelete}
          >
            <LuTrash2 />
          </IconButton>
        </TooltipWrapper>
      </HStack>
    </Box>
  );
};
