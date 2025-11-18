import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useCustomPrompts } from './useCustomPrompts';

const STORAGE_KEY = 'marketmind-custom-prompts';

describe('useCustomPrompts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns default chart analysis prompt initially', () => {
    const { result } = renderHook(() => useCustomPrompts());
    const prompt = result.current.getChartAnalysisPrompt();
    
    expect(prompt).toBeDefined();
    expect(() => JSON.parse(prompt)).not.toThrow();
  });

  it('returns default chat prompt initially', () => {
    const { result } = renderHook(() => useCustomPrompts());
    const prompt = result.current.getChatPrompt();
    
    expect(prompt).toBeDefined();
    expect(() => JSON.parse(prompt)).not.toThrow();
  });

  it('sets and retrieves custom chart analysis prompt', () => {
    const { result } = renderHook(() => useCustomPrompts());
    const customPrompt = JSON.stringify({ system: 'Custom chart analysis' }, null, 2);

    act(() => {
      result.current.setChartAnalysisPrompt(customPrompt);
    });

    expect(result.current.getChartAnalysisPrompt()).toBe(customPrompt);
  });

  it('sets and retrieves custom chat prompt', () => {
    const { result } = renderHook(() => useCustomPrompts());
    const customPrompt = JSON.stringify({ system: 'Custom chat' }, null, 2);

    act(() => {
      result.current.setChatPrompt(customPrompt);
    });

    expect(result.current.getChatPrompt()).toBe(customPrompt);
  });

  it('resets chart analysis prompt to default', () => {
    const { result } = renderHook(() => useCustomPrompts());
    const customPrompt = JSON.stringify({ system: 'Custom' }, null, 2);
    const defaultPrompt = result.current.getDefaultChartAnalysisPrompt();

    act(() => {
      result.current.setChartAnalysisPrompt(customPrompt);
    });

    expect(result.current.getChartAnalysisPrompt()).toBe(customPrompt);

    act(() => {
      result.current.resetChartAnalysisPrompt();
    });

    expect(result.current.getChartAnalysisPrompt()).toBe(defaultPrompt);
  });

  it('resets chat prompt to default', () => {
    const { result } = renderHook(() => useCustomPrompts());
    const customPrompt = JSON.stringify({ system: 'Custom' }, null, 2);
    const defaultPrompt = result.current.getDefaultChatPrompt();

    act(() => {
      result.current.setChatPrompt(customPrompt);
    });

    expect(result.current.getChatPrompt()).toBe(customPrompt);

    act(() => {
      result.current.resetChatPrompt();
    });

    expect(result.current.getChatPrompt()).toBe(defaultPrompt);
  });

  it('detects modified chart analysis prompt', () => {
    const { result } = renderHook(() => useCustomPrompts());

    expect(result.current.isChartAnalysisModified()).toBe(false);

    act(() => {
      result.current.setChartAnalysisPrompt(JSON.stringify({ system: 'Custom' }));
    });

    expect(result.current.isChartAnalysisModified()).toBe(true);
  });

  it('detects modified chat prompt', () => {
    const { result } = renderHook(() => useCustomPrompts());

    expect(result.current.isChatModified()).toBe(false);

    act(() => {
      result.current.setChatPrompt(JSON.stringify({ system: 'Custom' }));
    });

    expect(result.current.isChatModified()).toBe(true);
  });

  it('detects any modification', () => {
    const { result } = renderHook(() => useCustomPrompts());

    expect(result.current.isAnyModified()).toBe(false);

    act(() => {
      result.current.setChartAnalysisPrompt(JSON.stringify({ system: 'Custom' }));
    });

    expect(result.current.isAnyModified()).toBe(true);
  });

  it('resets all prompts to default', () => {
    const { result } = renderHook(() => useCustomPrompts());

    act(() => {
      result.current.setChartAnalysisPrompt(JSON.stringify({ system: 'Custom 1' }));
      result.current.setChatPrompt(JSON.stringify({ system: 'Custom 2' }));
    });

    expect(result.current.isAnyModified()).toBe(true);

    act(() => {
      result.current.resetAllPrompts();
    });

    expect(result.current.isAnyModified()).toBe(false);
  });

  it('persists prompts across hook instances', () => {
    const { result: result1 } = renderHook(() => useCustomPrompts());
    const customPrompt = JSON.stringify({ system: 'Persistent' }, null, 2);

    act(() => {
      result1.current.setChartAnalysisPrompt(customPrompt);
    });

    const { result: result2 } = renderHook(() => useCustomPrompts());
    
    expect(result2.current.getChartAnalysisPrompt()).toBe(customPrompt);
  });

  it('stores data in localStorage with correct key', () => {
    const { result } = renderHook(() => useCustomPrompts());
    const customPrompt = JSON.stringify({ system: 'Test' }, null, 2);

    act(() => {
      result.current.setChartAnalysisPrompt(customPrompt);
    });

    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).toBeDefined();
    
    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.chartAnalysis).toBe(customPrompt);
    }
  });
});
