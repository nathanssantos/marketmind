import { useCallback, useEffect } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../constants/defaults';
import { useUIPref } from '../store/preferencesStore';

export const useUIZoom = () => {
  const { zoom: zoomAdapter } = usePlatform();
  const [zoomLevel, setZoomLevel] = useUIPref<number>('uiZoomLevel', ZOOM_DEFAULT);

  useEffect(() => {
    zoomAdapter.setFactor(zoomLevel / 100);
  }, [zoomLevel, zoomAdapter]);

  const zoomIn = useCallback(() => {
    setZoomLevel((z) => Math.min(z + ZOOM_STEP, ZOOM_MAX));
  }, [setZoomLevel]);

  const zoomOut = useCallback(() => {
    setZoomLevel((z) => Math.max(z - ZOOM_STEP, ZOOM_MIN));
  }, [setZoomLevel]);

  const resetZoom = useCallback(() => {
    setZoomLevel(ZOOM_DEFAULT);
  }, [setZoomLevel]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        resetZoom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, resetZoom]);

  return { zoomLevel, zoomIn, zoomOut, resetZoom };
};
