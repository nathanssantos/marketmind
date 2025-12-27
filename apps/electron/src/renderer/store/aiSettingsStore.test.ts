import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_MODELS, useAISettingsStore } from './aiSettingsStore';

describe('aiSettingsStore', () => {
  beforeEach(() => {
    act(() => {
      useAISettingsStore.setState({
        settings: { provider: 'openai', model: 'gpt-4o' },
        provider: 'openai',
        model: 'gpt-4o',
        enableAIPatterns: true,
      });
    });
  });

  afterEach(() => {
    act(() => {
      useAISettingsStore.getState().clearSettings();
    });
  });

  it('should have default settings', () => {
    const { result } = renderHook(() => useAISettingsStore());
    expect(result.current.settings?.provider).toBe('openai');
    expect(result.current.settings?.model).toBe('gpt-4o');
    expect(result.current.enableAIPatterns).toBe(true);
  });

  it('should set settings', () => {
    const { result } = renderHook(() => useAISettingsStore());
    act(() => {
      result.current.setSettings({ provider: 'anthropic', model: 'claude-sonnet-4-5' });
    });
    expect(result.current.settings?.provider).toBe('anthropic');
    expect(result.current.settings?.model).toBe('claude-sonnet-4-5');
    expect(result.current.provider).toBe('anthropic');
    expect(result.current.model).toBe('claude-sonnet-4-5');
  });

  it('should update settings partially', () => {
    const { result } = renderHook(() => useAISettingsStore());
    act(() => {
      result.current.updateSettings({ temperature: 0.7 });
    });
    expect(result.current.settings?.temperature).toBe(0.7);
    expect(result.current.settings?.provider).toBe('openai');
  });

  it('should update default model when provider changes', () => {
    const { result } = renderHook(() => useAISettingsStore());
    act(() => {
      result.current.updateSettings({ provider: 'gemini' });
    });
    expect(result.current.settings?.provider).toBe('gemini');
    expect(result.current.settings?.model).toBe(DEFAULT_MODELS['gemini']);
  });

  it('should clear settings', () => {
    const { result } = renderHook(() => useAISettingsStore());
    act(() => {
      result.current.clearSettings();
    });
    expect(result.current.settings).toBeNull();
    expect(result.current.provider).toBeNull();
    expect(result.current.model).toBeNull();
  });

  it('should toggle AI patterns', () => {
    const { result } = renderHook(() => useAISettingsStore());
    expect(result.current.enableAIPatterns).toBe(true);
    act(() => {
      result.current.toggleAIPatterns();
    });
    expect(result.current.enableAIPatterns).toBe(false);
    act(() => {
      result.current.toggleAIPatterns();
    });
    expect(result.current.enableAIPatterns).toBe(true);
  });

  it('should load from storage', () => {
    const { result } = renderHook(() => useAISettingsStore());
    act(() => {
      result.current.loadFromStorage({
        settings: { provider: 'anthropic', model: 'claude-3-opus' },
        enableAIPatterns: false,
      });
    });
    expect(result.current.settings?.provider).toBe('anthropic');
    expect(result.current.enableAIPatterns).toBe(false);
  });

  it('should get storage data', () => {
    const { result } = renderHook(() => useAISettingsStore());
    act(() => {
      result.current.setSettings({ provider: 'openai', model: 'gpt-4' });
    });
    const storageData = result.current.getStorageData();
    expect(storageData.settings?.provider).toBe('openai');
    expect(storageData.enableAIPatterns).toBe(true);
  });
});
