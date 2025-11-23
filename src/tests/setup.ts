import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect, vi } from 'vitest';
import 'vitest-canvas-mock';

expect.extend(matchers);

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
global.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
  const id = ++rafId;
  queueMicrotask(() => callback(Date.now()));
  return id;
});

global.cancelAnimationFrame = vi.fn();

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
