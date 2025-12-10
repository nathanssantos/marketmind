import type { ElectronAPI } from '@main/preload';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';

declare global {
  interface Window {
    electron: ElectronAPI;
  }
  
  var __canvasManagerInstances: Set<CanvasManager> | undefined;
}

export { };
