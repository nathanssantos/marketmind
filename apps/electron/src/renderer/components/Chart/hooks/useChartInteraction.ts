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
  const isDraggingRef = useRef(false);

  const viewportRef = useRef(viewport);
  const onZoomRef = useRef(onZoom);
  const onPanRef = useRef(onPan);
  const onClickRef = useRef(onClick);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    onZoomRef.current = onZoom;
  }, [onZoom]);

  useEffect(() => {
    onPanRef.current = onPan;
  }, [onPan]);

  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const calculateMousePosition = useCallback(
    (clientX: number, clientY: number): MousePosition | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const canvasX = x * window.devicePixelRatio;
      const canvasY = y * window.devicePixelRatio;

      const vp = viewportRef.current;
      const viewportWidth = vp.end - vp.start;
      const klineIndex = Math.floor(vp.start + (canvasX / canvas.width) * viewportWidth);

      const priceRange = vp.maxPrice - vp.minPrice;
      const price = vp.maxPrice - (canvasY / canvas.height) * priceRange;

      return { x, y, canvasX, canvasY, klineIndex, price };
    },
    [canvasRef]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (!enabledRef.current) return;

      const position = calculateMousePosition(event.clientX, event.clientY);
      setMousePosition(position);

      if (isDraggingRef.current && onPanRef.current) {
        const deltaX = event.clientX - lastMouseX.current;
        onPanRef.current(deltaX);
        lastMouseX.current = event.clientX;
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (!enabledRef.current) return;
      isDraggingRef.current = true;
      setIsDragging(true);
      lastMouseX.current = event.clientX;
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (!enabledRef.current) return;

      if (isDraggingRef.current && Math.abs(event.clientX - lastMouseX.current) < 5 && onClickRef.current) {
        const position = calculateMousePosition(event.clientX, event.clientY);
        if (position) onClickRef.current(position);
      }

      isDraggingRef.current = false;
      setIsDragging(false);
    };

    const handleWheel = (event: WheelEvent) => {
      if (!enabledRef.current || !onZoomRef.current) return;

      event.preventDefault();
      const delta = event.deltaY > 0 ? -1 : 1;
      onZoomRef.current(delta, event.clientX);
    };

    const handleMouseEnter = () => {
      if (enabledRef.current) setIsHovering(true);
    };

    const handleMouseLeave = () => {
      if (enabledRef.current) {
        setIsHovering(false);
        setMousePosition(null);
        isDraggingRef.current = false;
        setIsDragging(false);
      }
    };

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
  }, [canvasRef, calculateMousePosition]);

  return { mousePosition, isDragging, isHovering };
};
