import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAutoUpdate } from './useAutoUpdate';

const mockElectron = {
  update: {
    getInfo: vi.fn(),
    onChecking: vi.fn(),
    onAvailable: vi.fn(),
    onNotAvailable: vi.fn(),
    onDownloadProgress: vi.fn(),
    onDownloaded: vi.fn(),
    onError: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    installUpdate: vi.fn(),
    startAutoCheck: vi.fn(),
    stopAutoCheck: vi.fn(),
  },
};

describe('useAutoUpdate', () => {
  beforeEach(() => {
    window.electron = mockElectron as never;
    
    mockElectron.update.getInfo.mockResolvedValue({ currentVersion: '1.0.0' });
    mockElectron.update.checkForUpdates.mockResolvedValue({ success: true });
    mockElectron.update.downloadUpdate.mockResolvedValue({ success: true });
    mockElectron.update.installUpdate.mockResolvedValue({ success: true });
    mockElectron.update.startAutoCheck.mockResolvedValue({ success: true });
    mockElectron.update.stopAutoCheck.mockResolvedValue({ success: true });

    vi.clearAllMocks();
  });

  it('should initialize with idle status', () => {
    const { result } = renderHook(() => useAutoUpdate());

    expect(result.current.status).toBe('idle');
    expect(result.current.updateInfo).toBe(null);
    expect(result.current.progress).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should fetch current version on mount', async () => {
    const { result } = renderHook(() => useAutoUpdate());

    await waitFor(() => {
      expect(result.current.currentVersion).toBe('1.0.0');
    });

    expect(mockElectron.update.getInfo).toHaveBeenCalled();
  });

  it('should register event listeners on mount', () => {
    renderHook(() => useAutoUpdate());

    expect(mockElectron.update.onChecking).toHaveBeenCalled();
    expect(mockElectron.update.onAvailable).toHaveBeenCalled();
    expect(mockElectron.update.onNotAvailable).toHaveBeenCalled();
    expect(mockElectron.update.onDownloadProgress).toHaveBeenCalled();
    expect(mockElectron.update.onDownloaded).toHaveBeenCalled();
    expect(mockElectron.update.onError).toHaveBeenCalled();
  });

  it('should update status to checking when onChecking is called', async () => {
    let checkingCallback: () => void = () => {};
    mockElectron.update.onChecking.mockImplementation((cb) => {
      checkingCallback = cb;
    });

    const { result } = renderHook(() => useAutoUpdate());

    act(() => {
      checkingCallback();
    });

    expect(result.current.status).toBe('checking');
    expect(result.current.error).toBe(null);
  });

  it('should update status to available when update is found', async () => {
    let availableCallback: (info: { version: string; releaseNotes?: string }) => void = () => {};
    mockElectron.update.onAvailable.mockImplementation((cb) => {
      availableCallback = cb;
    });

    const { result } = renderHook(() => useAutoUpdate());

    const updateInfo = { version: '2.0.0', releaseNotes: 'New features' };

    act(() => {
      availableCallback(updateInfo);
    });

    expect(result.current.status).toBe('available');
    expect(result.current.updateInfo).toEqual(updateInfo);
  });

  it('should update status to not-available when no update is found', async () => {
    let notAvailableCallback: (info: { version: string }) => void = () => {};
    mockElectron.update.onNotAvailable.mockImplementation((cb) => {
      notAvailableCallback = cb;
    });

    const { result } = renderHook(() => useAutoUpdate());

    act(() => {
      notAvailableCallback({ version: '1.0.0' });
    });

    expect(result.current.status).toBe('not-available');
  });

  it('should track download progress', async () => {
    let progressCallback: (progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void = () => {};
    mockElectron.update.onDownloadProgress.mockImplementation((cb) => {
      progressCallback = cb;
    });

    const { result } = renderHook(() => useAutoUpdate());

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
    mockElectron.update.onDownloaded.mockImplementation((cb) => {
      downloadedCallback = cb;
    });

    const { result } = renderHook(() => useAutoUpdate());

    act(() => {
      downloadedCallback({ version: '2.0.0' });
    });

    expect(result.current.status).toBe('downloaded');
    expect(result.current.progress).toBe(null);
  });

  it('should handle errors', async () => {
    let errorCallback: (error: { message: string; stack?: string }) => void = () => {};
    mockElectron.update.onError.mockImplementation((cb) => {
      errorCallback = cb;
    });

    const { result } = renderHook(() => useAutoUpdate());

    const errorInfo = { message: 'Update failed', stack: 'Error stack' };

    act(() => {
      errorCallback(errorInfo);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toEqual(errorInfo);
  });

  it('should check for updates', async () => {
    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(mockElectron.update.checkForUpdates).toHaveBeenCalled();
  });

  it('should handle check for updates error', async () => {
    mockElectron.update.checkForUpdates.mockResolvedValue({
      success: false,
      error: 'Network error',
    });

    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('Network error');
  });

  it('should download update', async () => {
    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.downloadUpdate();
    });

    expect(mockElectron.update.downloadUpdate).toHaveBeenCalled();
  });

  it('should handle download error', async () => {
    mockElectron.update.downloadUpdate.mockResolvedValue({
      success: false,
      error: 'Download failed',
    });

    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.downloadUpdate();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('Download failed');
  });

  it('should install update', async () => {
    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.installUpdate();
    });

    expect(mockElectron.update.installUpdate).toHaveBeenCalled();
  });

  it('should handle install error', async () => {
    mockElectron.update.installUpdate.mockResolvedValue({
      success: false,
      error: 'Install failed',
    });

    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.installUpdate();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('Install failed');
  });

  it('should start auto-check with default interval', async () => {
    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.startAutoCheck();
    });

    expect(mockElectron.update.startAutoCheck).toHaveBeenCalledWith(6);
  });

  it('should start auto-check with custom interval', async () => {
    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.startAutoCheck(12);
    });

    expect(mockElectron.update.startAutoCheck).toHaveBeenCalledWith(12);
  });

  it('should stop auto-check', async () => {
    const { result } = renderHook(() => useAutoUpdate());

    await act(async () => {
      await result.current.stopAutoCheck();
    });

    expect(mockElectron.update.stopAutoCheck).toHaveBeenCalled();
  });
});
