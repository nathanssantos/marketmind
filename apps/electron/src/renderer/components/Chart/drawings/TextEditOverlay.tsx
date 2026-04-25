import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS } from '@shared/constants';
import { useDrawingStore, compositeKey } from '@renderer/store/drawingStore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface TextEditOverlayProps {
  manager: CanvasManager | null;
  symbol: string;
  interval: string;
}

export const TextEditOverlay = ({ manager, symbol, interval }: TextEditOverlayProps) => {
  const selectedDrawingId = useDrawingStore(s => s.selectedDrawingId);
  const key = compositeKey(symbol, interval);
  const drawings = useDrawingStore(s => s.drawingsByKey[key]);
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedDrawing = useMemo(() => drawings?.find(d => d.id === selectedDrawingId) ?? null, [drawings, selectedDrawingId]);
  const isTextDrawing = selectedDrawing?.type === 'text';
  const textDrawing = isTextDrawing ? (selectedDrawing) : null;

  useEffect(() => {
    if (textDrawing?.text === '' && textDrawing.id !== editingId) {
      setEditing(true);
      setEditingId(textDrawing.id);
    }
  }, [textDrawing, editingId]);

  useEffect(() => {
    if (!editing) return;
    const ta = textareaRef.current;
    if (ta) {
      ta.focus();
      ta.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!isTextDrawing) {
      setEditing(false);
      setEditingId(null);
    }
  }, [isTextDrawing]);

  const handleBlur = useCallback(() => {
    if (!textDrawing) return;
    const val = textareaRef.current?.value.trim() ?? '';
    const store = useDrawingStore.getState();
    if (!val) {
      store.deleteDrawing(textDrawing.id, symbol, interval);
    } else {
      store.updateDrawing(textDrawing.id, { text: val });
    }
    setEditing(false);
  }, [textDrawing, symbol, interval]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (textDrawing && !textareaRef.current?.value.trim()) {
        useDrawingStore.getState().deleteDrawing(textDrawing.id, symbol, interval);
      }
      setEditing(false);
    }
  }, [handleBlur]);

  if (!textDrawing || !editing || !manager) return null;

  const x = manager.indexToCenterX(textDrawing.index);
  const y = manager.priceToY(textDrawing.price);

  return (
    <textarea
      ref={textareaRef}
      defaultValue={textDrawing.text}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y - textDrawing.fontSize * 1.2}px`,
        minWidth: '120px',
        minHeight: `${textDrawing.fontSize * 1.5}px`,
        font: `${textDrawing.fontWeight} ${textDrawing.fontSize}px sans-serif`,
        color: textDrawing.color ?? INDICATOR_COLORS.LABEL_TEXT,
        background: 'rgba(0, 0, 0, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        outline: 'none',
        resize: 'none',
        padding: '2px 4px',
        zIndex: 10,
      }}
    />
  );
};
