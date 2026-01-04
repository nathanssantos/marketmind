import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PinnedControlsProvider, usePinnedControls } from './PinnedControlsContext';

describe('PinnedControlsContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <PinnedControlsProvider>{children}</PinnedControlsProvider>
  );

  describe('usePinnedControls', () => {
    it('should throw error when used outside provider', () => {
      expect(() => {
        renderHook(() => usePinnedControls());
      }).toThrow('usePinnedControls must be used within PinnedControlsProvider');
    });

    it('should return empty set initially', () => {
      const { result } = renderHook(() => usePinnedControls(), { wrapper });

      expect(result.current.pinnedControls.size).toBe(0);
    });

    it('should add control to pinned set when toggling', () => {
      const { result } = renderHook(() => usePinnedControls(), { wrapper });

      act(() => {
        result.current.togglePin('rightMargin');
      });

      expect(result.current.pinnedControls.has('rightMargin')).toBe(true);
    });

    it('should remove control from pinned set when toggling again', () => {
      const { result } = renderHook(() => usePinnedControls(), { wrapper });

      act(() => {
        result.current.togglePin('rightMargin');
      });
      act(() => {
        result.current.togglePin('rightMargin');
      });

      expect(result.current.pinnedControls.has('rightMargin')).toBe(false);
    });

    it('should handle multiple pinned controls', () => {
      const { result } = renderHook(() => usePinnedControls(), { wrapper });

      act(() => {
        result.current.togglePin('rightMargin');
      });
      act(() => {
        result.current.togglePin('volumeHeightRatio');
      });
      act(() => {
        result.current.togglePin('klineSpacing');
      });

      expect(result.current.pinnedControls.size).toBe(3);
      expect(result.current.pinnedControls.has('rightMargin')).toBe(true);
      expect(result.current.pinnedControls.has('volumeHeightRatio')).toBe(true);
      expect(result.current.pinnedControls.has('klineSpacing')).toBe(true);
    });

    it('should return true for isPinned when control is pinned', () => {
      const { result } = renderHook(() => usePinnedControls(), { wrapper });

      act(() => {
        result.current.togglePin('gridLineWidth');
      });

      expect(result.current.isPinned('gridLineWidth')).toBe(true);
    });

    it('should return false for isPinned when control is not pinned', () => {
      const { result } = renderHook(() => usePinnedControls(), { wrapper });

      expect(result.current.isPinned('gridLineWidth')).toBe(false);
    });

    it('should return false for isPinned after unpinning', () => {
      const { result } = renderHook(() => usePinnedControls(), { wrapper });

      act(() => {
        result.current.togglePin('paddingTop');
      });
      act(() => {
        result.current.togglePin('paddingTop');
      });

      expect(result.current.isPinned('paddingTop')).toBe(false);
    });

    it('should work with all control types', () => {
      const { result } = renderHook(() => usePinnedControls(), { wrapper });
      const controls = [
        'rightMargin',
        'volumeHeightRatio',
        'klineSpacing',
        'klineWickWidth',
        'gridLineWidth',
        'paddingTop',
        'paddingBottom',
        'paddingLeft',
        'paddingRight',
      ] as const;

      controls.forEach((control) => {
        act(() => {
          result.current.togglePin(control);
        });
      });

      expect(result.current.pinnedControls.size).toBe(9);
      controls.forEach((control) => {
        expect(result.current.isPinned(control)).toBe(true);
      });
    });
  });
});
