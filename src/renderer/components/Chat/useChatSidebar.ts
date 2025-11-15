import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalStorage } from '@/renderer/hooks/useLocalStorage';

const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 400;

export const useChatSidebar = () => {
  const [isOpen, setIsOpen] = useLocalStorage('chat-sidebar-open', true);
  const [width, setWidth] = useLocalStorage('chat-sidebar-width', DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const toggleSidebar = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, [setIsOpen]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
  }, [width]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const delta = startXRef.current - e.clientX;
    const newWidth = Math.min(
      Math.max(startWidthRef.current + delta, MIN_WIDTH),
      MAX_WIDTH
    );
    setWidth(newWidth);
  }, [isResizing, setWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return {
    isOpen,
    width,
    toggleSidebar,
    handleResize: handleMouseMove,
    handleMouseDown,
  };
};
