import type { ElectronAPI } from '@main/preload';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';

declare global {
  interface Window {
    electron: ElectronAPI;
    __MM_BACKEND_URL__?: string;
  }
  
  var __canvasManagerInstances: Set<CanvasManager> | undefined;
}

export { };
