import type { BrowserWindow } from 'electron';
import { screen } from 'electron';
import Store from 'electron-store';

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isFullScreen: boolean;
}

const DEFAULT_STATE: WindowState = {
  width: 1280,
  height: 800,
  isMaximized: false,
  isFullScreen: false,
};

export class WindowStateManager {
  private store: Store;
  private state: WindowState;
  private window: BrowserWindow | null = null;

  constructor() {
    this.store = new Store({
      name: 'window-state',
    });

    this.state = this.loadState();
  }

  private loadState(): WindowState {
    const savedState = this.store.get('windowState') as WindowState | undefined;
    
    if (!savedState) {
      return DEFAULT_STATE;
    }

    const isWithinBounds = this.isStateWithinDisplayBounds(savedState);
    
    if (!isWithinBounds) {
      return DEFAULT_STATE;
    }

    return savedState;
  }

  private isStateWithinDisplayBounds(state: WindowState): boolean {
    if (state.x === undefined || state.y === undefined) {
      return true;
    }

    const displays = screen.getAllDisplays();
    
    return displays.some(display => {
      const { x, y, width, height } = display.bounds;
      return (
        state.x! >= x &&
        state.y! >= y &&
        state.x! + state.width <= x + width &&
        state.y! + state.height <= y + height
      );
    });
  }

  public manage(window: BrowserWindow): void {
    this.window = window;

    if (this.state.isMaximized) {
      window.maximize();
    }

    if (this.state.isFullScreen) {
      window.setFullScreen(true);
    }

    const saveBoundsDebounced = this.debounce(() => this.saveState(), 500);

    window.on('resize', saveBoundsDebounced);
    window.on('move', saveBoundsDebounced);
    window.on('maximize', () => this.saveState());
    window.on('unmaximize', () => this.saveState());
    window.on('enter-full-screen', () => this.saveState());
    window.on('leave-full-screen', () => this.saveState());
    window.on('close', () => this.saveState());
  }

  private saveState(): void {
    if (!this.window) {
      return;
    }

    const isMaximized = this.window.isMaximized();
    const isFullScreen = this.window.isFullScreen();

    if (!isMaximized && !isFullScreen) {
      const bounds = this.window.getBounds();
      this.state = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized,
        isFullScreen,
      };
    } else {
      this.state = {
        ...this.state,
        isMaximized,
        isFullScreen,
      };
    }

    this.store.set('windowState', this.state);
  }

  private debounce<T extends (...args: unknown[]) => void>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>): void => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  public getState(): WindowState {
    return this.state;
  }

  public resetState(): void {
    this.state = DEFAULT_STATE;
    this.store.delete('windowState');
  }
}

export const windowStateManager = new WindowStateManager();
