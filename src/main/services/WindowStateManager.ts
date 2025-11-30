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
  private state: WindowState | null = null;
  private window: BrowserWindow | null = null;

  constructor() {
    this.store = new Store({
      name: 'window-state',
    });
  }

  private loadState(): WindowState {
    if (this.state) {
      return this.state;
    }

    const savedState = this.store.get('windowState') as WindowState | undefined;
    
    if (!savedState) {
      this.state = DEFAULT_STATE;
      return this.state;
    }

    const isWithinBounds = this.isStateWithinDisplayBounds(savedState);
    
    if (!isWithinBounds) {
      this.state = DEFAULT_STATE;
      return this.state;
    }

    this.state = savedState;
    return this.state;
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
    
    const state = this.loadState();

    if (state.isMaximized) {
      window.maximize();
    }

    if (state.isFullScreen) {
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
      const currentState = this.state ?? DEFAULT_STATE;
      const newState: WindowState = {
        width: currentState.width,
        height: currentState.height,
        isMaximized,
        isFullScreen,
      };
      if (currentState.x !== undefined) newState.x = currentState.x;
      if (currentState.y !== undefined) newState.y = currentState.y;
      this.state = newState;
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
    return this.loadState();
  }

  public resetState(): void {
    this.state = DEFAULT_STATE;
    this.store.delete('windowState');
  }
}

export const windowStateManager = new WindowStateManager();
