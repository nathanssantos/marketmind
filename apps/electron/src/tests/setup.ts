import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect, vi } from 'vitest';
import { workerPool } from '../renderer/utils/WorkerPool';

expect.extend(matchers);

const createUseLocalStorageMock = () => {
  const stores = new Map<string, unknown>();

  return function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
    const React = require('react');
    const storedValue = stores.has(key) ? stores.get(key) : initialValue;
    const [value, setValueState] = React.useState<T>(storedValue as T);

    const setValue = React.useCallback((newValue: T | ((prev: T) => T)) => {
      setValueState((prev: T) => {
        const computed = typeof newValue === 'function'
          ? (newValue as (prev: T) => T)(prev)
          : newValue;
        stores.set(key, computed);
        return computed;
      });
    }, [key]);

    return [value, setValue];
  };
};

vi.mock('@/renderer/hooks/useLocalStorage', () => ({
  useLocalStorage: createUseLocalStorageMock(),
}));

const mockPreferences = new Map<string, Record<string, unknown>>();

vi.mock('@/renderer/utils/trpc', () => {
  const mockMutate = vi.fn().mockResolvedValue({ success: true });
  const mockMutation = {
    mutate: mockMutate,
    mutateAsync: mockMutate,
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
    data: null,
    reset: vi.fn(),
  };

  return {
    trpc: {
      useUtils: () => ({
        preferences: {
          getByCategory: {
            invalidate: vi.fn(),
          },
        },
      }),
      auth: {
        me: {
          useQuery: () => ({
            data: { id: 'test-user', email: 'test@test.com' },
            isLoading: false,
            error: null,
          }),
        },
      },
      preferences: {
        getByCategory: {
          useQuery: (input: { category: string }) => ({
            data: mockPreferences.get(input?.category) || {},
            isLoading: false,
            isSuccess: true,
            error: null,
          }),
        },
        set: {
          useMutation: () => mockMutation,
        },
      },
    },
    setMockPreference: (category: string, key: string, value: unknown) => {
      const current = mockPreferences.get(category) || {};
      mockPreferences.set(category, { ...current, [key]: value });
    },
    clearMockPreferences: () => {
      mockPreferences.clear();
    },
  };
});

vi.mock('@/renderer/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({
    preferences: {},
    isLoading: false,
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn().mockResolvedValue({ success: true }),
    bulkSet: vi.fn().mockResolvedValue({ success: true }),
    invalidate: vi.fn(),
  }),
  useChartPreferences: () => ({
    preferences: {},
    isLoading: false,
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn().mockResolvedValue({ success: true }),
  }),
  useUIPreferences: () => ({
    preferences: {},
    isLoading: false,
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn().mockResolvedValue({ success: true }),
  }),
  useTradingPreferences: () => ({
    preferences: {},
    isLoading: false,
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn().mockResolvedValue({ success: true }),
  }),
  useNotificationPreferences: () => ({
    preferences: {},
    isLoading: false,
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn().mockResolvedValue({ success: true }),
  }),
  useRecentPreferences: () => ({
    preferences: {},
    isLoading: false,
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn().mockResolvedValue({ success: true }),
  }),
  useAllPreferences: () => ({
    allPreferences: {},
    isLoading: false,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  workerPool.terminateAll();
  vi.clearAllTimers();
  vi.clearAllMocks();
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

const indexedDBStore = new Map<string, any>();

afterEach(() => {
  indexedDBStore.clear();
  pendingRafCallbacks.clear();
  rafId = 0;
});

global.indexedDB = {
  open: vi.fn().mockImplementation((_name: string, _version: number) => {
    const request: any = {
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      result: {
        objectStoreNames: {
          contains: () => false,
        },
        createObjectStore: vi.fn().mockReturnValue({
          createIndex: vi.fn(),
        }),
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            get: vi.fn().mockImplementation((key: string) => {
              const mockRequest: any = {
                onsuccess: null,
                onerror: null,
                result: indexedDBStore.get(key),
              };
              queueMicrotask(() => {
                if (mockRequest.onsuccess) {
                  mockRequest.onsuccess();
                }
              });
              return mockRequest;
            }),
            put: vi.fn().mockImplementation((value: any) => {
              indexedDBStore.set(value.key, value);
              const mockRequest: any = {
                onsuccess: null,
                onerror: null,
              };
              queueMicrotask(() => {
                if (mockRequest.onsuccess) {
                  mockRequest.onsuccess();
                }
              });
              return mockRequest;
            }),
            delete: vi.fn().mockImplementation((key: string) => {
              indexedDBStore.delete(key);
              const mockRequest: any = {
                onsuccess: null,
                onerror: null,
              };
              queueMicrotask(() => {
                if (mockRequest.onsuccess) {
                  mockRequest.onsuccess();
                }
              });
              return mockRequest;
            }),
            clear: vi.fn().mockImplementation(() => {
              indexedDBStore.clear();
              const mockRequest: any = {
                onsuccess: null,
                onerror: null,
              };
              queueMicrotask(() => {
                if (mockRequest.onsuccess) {
                  mockRequest.onsuccess();
                }
              });
              return mockRequest;
            }),
            count: vi.fn().mockImplementation(() => {
              const mockRequest: any = {
                onsuccess: null,
                onerror: null,
                result: indexedDBStore.size,
              };
              queueMicrotask(() => {
                if (mockRequest.onsuccess) {
                  mockRequest.onsuccess();
                }
              });
              return mockRequest;
            }),
            getAllKeys: vi.fn().mockImplementation(() => {
              const mockRequest: any = {
                onsuccess: null,
                onerror: null,
                result: Array.from(indexedDBStore.keys()),
              };
              queueMicrotask(() => {
                if (mockRequest.onsuccess) {
                  mockRequest.onsuccess();
                }
              });
              return mockRequest;
            }),
            index: vi.fn().mockReturnValue({
              openCursor: vi.fn().mockImplementation((range: any) => {
                const entries = Array.from(indexedDBStore.entries());
                let currentIndex = 0;
                const mockRequest: any = {
                  onsuccess: null,
                  onerror: null,
                  result: null,
                };
                
                const getNextCursor = (): any => {
                  while (currentIndex < entries.length) {
                    const entry = entries[currentIndex];
                    if (!entry) break;
                    const [key, value] = entry;
                    currentIndex++;
                    
                    if (!value || typeof value.expiresAt !== 'number') continue;
                    
                    if (range && range.upper !== undefined) {
                      if (value.expiresAt <= range.upper) {
                        return {
                          value,
                          key,
                          continue: () => {
                            mockRequest.result = getNextCursor();
                            if (mockRequest.onsuccess) {
                              mockRequest.onsuccess({ target: mockRequest });
                            }
                          },
                          delete: () => {
                            if (key) indexedDBStore.delete(key);
                          },
                        };
                      }
                    }
                  }
                  return null;
                };
                
                queueMicrotask(() => {
                  mockRequest.result = getNextCursor();
                  if (mockRequest.onsuccess) {
                    mockRequest.onsuccess({ target: mockRequest });
                  }
                });
                
                return mockRequest;
              }),
            }),
          }),
        }),
        close: vi.fn(),
      },
    };

    queueMicrotask(() => {
      if (request.onupgradeneeded) {
        request.onupgradeneeded({ target: request } as any);
      }
      if (request.onsuccess) {
        request.onsuccess();
      }
    });

    return request;
  }),
  deleteDatabase: vi.fn(),
  databases: vi.fn(),
  cmp: vi.fn(),
} as any;

global.IDBKeyRange = {
  bound: vi.fn(),
  lowerBound: vi.fn(),
  upperBound: vi.fn(),
  only: vi.fn(),
} as any;

let rafId = 0;
const pendingRafCallbacks = new Map<number, FrameRequestCallback>();

global.requestAnimationFrame = (callback: FrameRequestCallback) => {
  const id = ++rafId;
  pendingRafCallbacks.set(id, callback);
  setTimeout(() => {
    if (pendingRafCallbacks.has(id)) {
      callback(performance.now());
      pendingRafCallbacks.delete(id);
    }
  }, 16);
  return id;
};

global.cancelAnimationFrame = (id: number) => {
  pendingRafCallbacks.delete(id);
};

class MockWorker {
  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  
  constructor(url: string | URL) {
    this.url = url.toString();
  }
  
  postMessage(message: any) {
    queueMicrotask(() => {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', { data: message }));
      }
    });
  }
  
  terminate() {
    this.onmessage = null;
    this.onerror = null;
  }
  
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
}

global.Worker = MockWorker as any;

const originalCreateElement = document.createElement.bind(document);
document.createElement = function (tagName: string, options?: any) {
  if (tagName.toLowerCase() === 'canvas') {
    const canvas = originalCreateElement('canvas', options);
    
    const mockContext = {
      canvas,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      imageSmoothingEnabled: true,
      font: '10px sans-serif',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      lineCap: 'butt',
      lineJoin: 'miter',
      miterLimit: 10,
      shadowBlur: 0,
      shadowColor: 'rgba(0, 0, 0, 0)',
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      quadraticCurveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      rect: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
      drawImage: vi.fn(),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      createPattern: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      translate: vi.fn(),
      transform: vi.fn(),
      setTransform: vi.fn(),
      resetTransform: vi.fn(),
      clip: vi.fn(),
      isPointInPath: vi.fn(() => false),
      isPointInStroke: vi.fn(() => false),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(),
        width: 0,
        height: 0,
      })),
      putImageData: vi.fn(),
      createImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(),
        width: 0,
        height: 0,
      })),
      setLineDash: vi.fn(),
      getLineDash: vi.fn(() => []),
      lineDashOffset: 0,
    };
    
    const originalGetContext = canvas.getContext.bind(canvas);
    canvas.getContext = function(contextId: string, options?: any) {
      if (contextId === '2d') {
        return mockContext as any;
      }
      return originalGetContext(contextId, options);
    };
    
    return canvas;
  }
  return originalCreateElement(tagName, options);
};
