import { useCallback, useEffect, useRef, useState } from 'react';

export interface MousePosition {
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
  klineIndex: number;
  price: number;
}

export interface UseChartInteractionProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  viewport: {
    start: number;
    end: number;
    minPrice: number;
    maxPrice: number;
  };
  enabled?: boolean;
  onZoom?: (delta: number, mouseX: number) => void;
  onPan?: (deltaX: number) => void;
  onClick?: (position: MousePosition) => void;
}

export interface UseChartInteractionResult {
  mousePosition: MousePosition | null;
  isDragging: boolean;
  isHovering: boolean;
}

export const useChartInteraction = ({
  canvasRef,
  viewport,
  enabled = true,
  onZoom,
  onPan,
  onClick,
}: UseChartInteractionProps): UseChartInteractionResult => {
  const [mousePosition, setMousePosition] = useState<MousePosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const lastMouseX = useRef<number>(0);

  const calculateMousePosition = useCallback(
    (clientX: number, clientY: number): MousePosition | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const canvasX = x * window.devicePixelRatio;
      const canvasY = y * window.devicePixelRatio;

      const viewportWidth = viewport.end - viewport.start;
      const klineIndex = Math.floor(viewport.start + (canvasX / canvas.width) * viewportWidth);

      const priceRange = viewport.maxPrice - viewport.minPrice;
      const price = viewport.maxPrice - (canvasY / canvas.height) * priceRange;

      return { x, y, canvasX, canvasY, klineIndex, price };
    },
    [canvasRef, viewport]
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!enabled) return;

      const position = calculateMousePosition(event.clientX, event.clientY);
      setMousePosition(position);

      if (isDragging && onPan) {
        const deltaX = event.clientX - lastMouseX.current;
        onPan(deltaX);
        lastMouseX.current = event.clientX;
      }
    },
    [enabled, calculateMousePosition, isDragging, onPan]
  );

  const handleMouseDown = useCallback(
    (event: MouseEvent) => {
      if (!enabled) return;
      setIsDragging(true);
      lastMouseX.current = event.clientX;
    },
    [enabled]
  );

  const handleMouseUp = useCallback(
    (event: MouseEvent) => {
      if (!enabled) return;

      if (isDragging && Math.abs(event.clientX - lastMouseX.current) < 5 && onClick) {
        const position = calculateMousePosition(event.clientX, event.clientY);
        if (position) onClick(position);
      }

      setIsDragging(false);
    },
    [enabled, isDragging, calculateMousePosition, onClick]
  );

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (!enabled || !onZoom) return;

      event.preventDefault();
      const delta = event.deltaY > 0 ? -1 : 1;
      onZoom(delta, event.clientX);
    },
    [enabled, onZoom]
  );

  const handleMouseEnter = useCallback(() => {
    if (enabled) setIsHovering(true);
  }, [enabled]);

  const handleMouseLeave = useCallback(() => {
    if (enabled) {
      setIsHovering(false);
      setMousePosition(null);
      setIsDragging(false);
    }
  }, [enabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mouseenter', handleMouseEnter);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mouseenter', handleMouseEnter);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [
    canvasRef,
    enabled,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleWheel,
    handleMouseEnter,
    handleMouseLeave,
  ]);

  return { mousePosition, isDragging, isHovering };
};
