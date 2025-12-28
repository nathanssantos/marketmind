import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { PlatformProvider } from '../context/PlatformContext';
import type { PlatformAdapter, UpdateAdapter } from '../adapters/types';
import { useAutoUpdate } from './useAutoUpdate';

const createMockUpdateAdapter = (): UpdateAdapter => ({
  isSupported: vi.fn().mockReturnValue(true),
  getInfo: vi.fn().mockResolvedValue({ currentVersion: '1.0.0', platform: 'darwin' }),
  onChecking: vi.fn(),
  onAvailable: vi.fn(),
  onNotAvailable: vi.fn(),
  onDownloadProgress: vi.fn(),
  onDownloaded: vi.fn(),
  onError: vi.fn(),
  checkForUpdates: vi.fn().mockResolvedValue({ success: true }),
  downloadUpdate: vi.fn().mockResolvedValue({ success: true }),
  installUpdate: vi.fn().mockResolvedValue({ success: true }),
  startAutoCheck: vi.fn().mockResolvedValue({ success: true }),
  stopAutoCheck: vi.fn().mockResolvedValue({ success: true }),
});

const createMockAdapter = (updateAdapter: UpdateAdapter): PlatformAdapter => ({
  platform: 'electron',
  storage: {
    isEncryptionAvailable: vi.fn().mockResolvedValue(true),
    setApiKey: vi.fn().mockResolvedValue({ success: true }),
    getApiKey: vi.fn().mockResolvedValue({ success: true, apiKey: null }),
    deleteApiKey: vi.fn().mockResolvedValue(true),
    hasApiKey: vi.fn().mockResolvedValue(false),
    getAllApiKeys: vi.fn().mockResolvedValue({}),
    clearAllApiKeys: vi.fn().mockResolvedValue(true),
    getTradingData: vi.fn().mockResolvedValue({ success: true, data: null }),
    setTradingData: vi.fn().mockResolvedValue({ success: true }),
    clearTradingData: vi.fn().mockResolvedValue({ success: true }),
    getAIData: vi.fn().mockResolvedValue({ success: true, data: null }),
    setAIData: vi.fn().mockResolvedValue({ success: true }),
    clearAIData: vi.fn().mockResolvedValue({ success: true }),
    getAIPatternsForSymbol: vi.fn().mockResolvedValue({ success: true, data: null }),
    setAIPatternsForSymbol: vi.fn().mockResolvedValue({ success: true }),
    deleteAIPatternsForSymbol: vi.fn().mockResolvedValue({ success: true }),
    getNewsSettings: vi.fn().mockResolvedValue({ success: true, data: null }),
    setNewsSettings: vi.fn().mockResolvedValue({ success: true }),
  },
  update: updateAdapter,
  notification: {
    isSupported: vi.fn().mockResolvedValue(true),
    show: vi.fn().mockResolvedValue({ success: true }),
    requestPermission: vi.fn().mockResolvedValue('granted'),
  },
  window: {
    openChart: vi.fn().mockResolvedValue({ success: true }),
    getChartWindows: vi.fn().mockResolvedValue([]),
  },
  http: {
    get: vi.fn().mockResolvedValue({ success: true, data: null }),
    post: vi.fn().mockResolvedValue({ success: true, data: null }),
  },
});

let mockUpdateAdapter: UpdateAdapter;
let mockAdapter: PlatformAdapter;

const wrapper = ({ children }: { children: ReactNode }) => (
  <PlatformProvider adapter={mockAdapter}>{children}</PlatformProvider>
);

describe('useAutoUpdate', () => {
  beforeEach(() => {
    mockUpdateAdapter = createMockUpdateAdapter();
    mockAdapter = createMockAdapter(mockUpdateAdapter);
    vi.clearAllMocks();
  });

  it('should initialize with idle status', () => {
    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    expect(result.current.status).toBe('idle');
    expect(result.current.updateInfo).toBe(null);
    expect(result.current.progress).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should fetch current version on mount', async () => {
    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentVersion).toBe('1.0.0');
    });

    expect(mockUpdateAdapter.getInfo).toHaveBeenCalled();
  });

  it('should register event listeners on mount', () => {
    renderHook(() => useAutoUpdate(), { wrapper });

    expect(mockUpdateAdapter.onChecking).toHaveBeenCalled();
    expect(mockUpdateAdapter.onAvailable).toHaveBeenCalled();
    expect(mockUpdateAdapter.onNotAvailable).toHaveBeenCalled();
    expect(mockUpdateAdapter.onDownloadProgress).toHaveBeenCalled();
    expect(mockUpdateAdapter.onDownloaded).toHaveBeenCalled();
    expect(mockUpdateAdapter.onError).toHaveBeenCalled();
  });

  it('should update status to checking when onChecking is called', async () => {
    let checkingCallback: () => void = () => {};
    vi.mocked(mockUpdateAdapter.onChecking).mockImplementation((cb) => {
      checkingCallback = cb;
    });

    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    act(() => {
      checkingCallback();
    });

    expect(result.current.status).toBe('checking');
    expect(result.current.error).toBe(null);
  });

  it('should update status to available when update is found', async () => {
    let availableCallback: (info: { version: string; releaseNotes?: string }) => void = () => {};
    vi.mocked(mockUpdateAdapter.onAvailable).mockImplementation((cb) => {
      availableCallback = cb;
    });

    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    const updateInfo = { version: '2.0.0', releaseNotes: 'New features' };

    act(() => {
      availableCallback(updateInfo);
    });

    expect(result.current.status).toBe('available');
    expect(result.current.updateInfo).toEqual(updateInfo);
  });

  it('should update status to not-available when no update is found', async () => {
    let notAvailableCallback: (info: { version: string }) => void = () => {};
    vi.mocked(mockUpdateAdapter.onNotAvailable).mockImplementation((cb) => {
      notAvailableCallback = cb;
    });

    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    act(() => {
      notAvailableCallback({ version: '1.0.0' });
    });

    expect(result.current.status).toBe('not-available');
  });

  it('should track download progress', async () => {
    let progressCallback: (progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void = () => {};
    vi.mocked(mockUpdateAdapter.onDownloadProgress).mockImplementation((cb) => {
      progressCallback = cb;
    });

    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    const progressInfo = {
      percent: 50,
      transferred: 500000,
      total: 1000000,
      bytesPerSecond: 100000,
    };

    act(() => {
      progressCallback(progressInfo);
    });

    expect(result.current.status).toBe('downloading');
    expect(result.current.progress).toEqual(progressInfo);
  });

  it('should update status to downloaded when download completes', async () => {
    let downloadedCallback: (info: { version: string }) => void = () => {};
    vi.mocked(mockUpdateAdapter.onDownloaded).mockImplementation((cb) => {
      downloadedCallback = cb;
    });

    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    act(() => {
      downloadedCallback({ version: '2.0.0' });
    });

    expect(result.current.status).toBe('downloaded');
    expect(result.current.progress).toBe(null);
  });

  it('should handle errors', async () => {
    let errorCallback: (error: { message: string; stack?: string }) => void = () => {};
    vi.mocked(mockUpdateAdapter.onError).mockImplementation((cb) => {
      errorCallback = cb;
    });

    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    const errorInfo = { message: 'Update failed', stack: 'Error stack' };

    act(() => {
      errorCallback(errorInfo);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toEqual(errorInfo);
  });

  it('should check for updates', async () => {
    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(mockUpdateAdapter.checkForUpdates).toHaveBeenCalled();
  });

  it('should handle check for updates error', async () => {
    vi.mocked(mockUpdateAdapter.checkForUpdates).mockResolvedValue({
      success: false,
      error: 'Network error',
    });

    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('Network error');
  });

  it('should download update', async () => {
    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    await act(async () => {
      await result.current.downloadUpdate();
    });

    expect(mockUpdateAdapter.downloadUpdate).toHaveBeenCalled();
  });

  it('should handle download error', async () => {
    vi.mocked(mockUpdateAdapter.downloadUpdate).mockResolvedValue({
      success: false,
      error: 'Download failed',
    });

    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    await act(async () => {
      await result.current.downloadUpdate();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('Download failed');
  });

  it('should install update', async () => {
    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    await act(async () => {
      await result.current.installUpdate();
    });

    expect(mockUpdateAdapter.installUpdate).toHaveBeenCalled();
  });

  it('should handle install error', async () => {
    vi.mocked(mockUpdateAdapter.installUpdate).mockResolvedValue({
      success: false,
      error: 'Install failed',
    });

    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    await act(async () => {
      await result.current.installUpdate();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('Install failed');
  });

  it('should start auto-check with default interval', async () => {
    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    await act(async () => {
      await result.current.startAutoCheck();
    });

    expect(mockUpdateAdapter.startAutoCheck).toHaveBeenCalledWith(6);
  });

  it('should start auto-check with custom interval', async () => {
    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    await act(async () => {
      await result.current.startAutoCheck(12);
    });

    expect(mockUpdateAdapter.startAutoCheck).toHaveBeenCalledWith(12);
  });

  it('should stop auto-check', async () => {
    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    await act(async () => {
      await result.current.stopAutoCheck();
    });

    expect(mockUpdateAdapter.stopAutoCheck).toHaveBeenCalled();
  });

  it('should handle startAutoCheck errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(mockUpdateAdapter.startAutoCheck).mockResolvedValueOnce({
      success: false,
      error: 'Failed to start'
    });

    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    await act(async () => {
      await result.current.startAutoCheck();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to start auto-check:', 'Failed to start');
    consoleErrorSpy.mockRestore();
  });

  it('should handle stopAutoCheck errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(mockUpdateAdapter.stopAutoCheck).mockResolvedValueOnce({
      success: false,
      error: 'Failed to stop'
    });

    const { result } = renderHook(() => useAutoUpdate(), { wrapper });

    await act(async () => {
      await result.current.stopAutoCheck();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to stop auto-check:', 'Failed to stop');
    consoleErrorSpy.mockRestore();
  });
});
