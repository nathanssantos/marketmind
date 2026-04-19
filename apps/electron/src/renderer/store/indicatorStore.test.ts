import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useIndicatorStore } from './indicatorStore';

const resetState = () =>
  act(() => {
    useIndicatorStore.setState({ instances: [] });
  });

describe('indicatorStore (instances API)', () => {
  beforeEach(resetState);
  afterEach(resetState);

  it('starts with no instances', () => {
    const { result } = renderHook(() => useIndicatorStore());
    expect(result.current.instances).toEqual([]);
    expect(result.current.getVisibleInstances()).toEqual([]);
  });

  it('addInstance appends and returns a generated id', () => {
    const { result } = renderHook(() => useIndicatorStore());
    let id = '';
    act(() => {
      id = result.current.addInstance({
        userIndicatorId: 'ui-1',
        catalogType: 'rsi',
        params: { period: 14 },
        visible: true,
      });
    });
    expect(id).toBeTruthy();
    expect(result.current.instances).toHaveLength(1);
    expect(result.current.instances[0]?.id).toBe(id);
    expect(result.current.instances[0]?.catalogType).toBe('rsi');
  });

  it('updateInstance merges params and patch fields', () => {
    const { result } = renderHook(() => useIndicatorStore());
    let id = '';
    act(() => {
      id = result.current.addInstance({
        userIndicatorId: 'ui-1',
        catalogType: 'macd',
        params: { fast: 12, slow: 26, signal: 9 },
        visible: true,
      });
    });
    act(() => {
      result.current.updateInstance(id, { params: { fast: 8 }, visible: false });
    });
    const inst = result.current.instances[0]!;
    expect(inst.params).toEqual({ fast: 8, slow: 26, signal: 9 });
    expect(inst.visible).toBe(false);
  });

  it('toggleInstanceVisible flips only the targeted instance', () => {
    const { result } = renderHook(() => useIndicatorStore());
    let idA = '';
    let idB = '';
    act(() => {
      idA = result.current.addInstance({
        userIndicatorId: 'ui-a',
        catalogType: 'rsi',
        params: { period: 14 },
        visible: true,
      });
      idB = result.current.addInstance({
        userIndicatorId: 'ui-b',
        catalogType: 'ema',
        params: { period: 20 },
        visible: true,
      });
    });
    act(() => {
      result.current.toggleInstanceVisible(idA);
    });
    const byId = new Map(result.current.instances.map((i) => [i.id, i]));
    expect(byId.get(idA)?.visible).toBe(false);
    expect(byId.get(idB)?.visible).toBe(true);
  });

  it('removeInstance removes by id', () => {
    const { result } = renderHook(() => useIndicatorStore());
    let id = '';
    act(() => {
      id = result.current.addInstance({
        userIndicatorId: 'ui-1',
        catalogType: 'rsi',
        params: {},
        visible: true,
      });
    });
    act(() => {
      result.current.removeInstance(id);
    });
    expect(result.current.instances).toEqual([]);
  });

  it('removeInstancesByUserIndicatorId removes all instances sharing the userIndicatorId', () => {
    const { result } = renderHook(() => useIndicatorStore());
    act(() => {
      result.current.addInstance({ userIndicatorId: 'ui-1', catalogType: 'rsi', params: {}, visible: true });
      result.current.addInstance({ userIndicatorId: 'ui-1', catalogType: 'rsi', params: {}, visible: true, paneId: 'alt' });
      result.current.addInstance({ userIndicatorId: 'ui-2', catalogType: 'ema', params: {}, visible: true });
    });
    act(() => {
      result.current.removeInstancesByUserIndicatorId('ui-1');
    });
    expect(result.current.instances).toHaveLength(1);
    expect(result.current.instances[0]?.userIndicatorId).toBe('ui-2');
  });

  it('reorderInstances applies the given order', () => {
    const { result } = renderHook(() => useIndicatorStore());
    let a = '', b = '', c = '';
    act(() => {
      a = result.current.addInstance({ userIndicatorId: 'a', catalogType: 'rsi', params: {}, visible: true });
      b = result.current.addInstance({ userIndicatorId: 'b', catalogType: 'rsi', params: {}, visible: true });
      c = result.current.addInstance({ userIndicatorId: 'c', catalogType: 'rsi', params: {}, visible: true });
    });
    act(() => {
      result.current.reorderInstances([c, a, b]);
    });
    expect(result.current.instances.map((i) => i.id)).toEqual([c, a, b]);
  });

  it('getVisibleInstances filters out hidden instances', () => {
    const { result } = renderHook(() => useIndicatorStore());
    act(() => {
      result.current.addInstance({ userIndicatorId: 'a', catalogType: 'rsi', params: {}, visible: true });
      result.current.addInstance({ userIndicatorId: 'b', catalogType: 'rsi', params: {}, visible: false });
    });
    expect(result.current.getVisibleInstances()).toHaveLength(1);
    expect(result.current.getVisibleInstances()[0]?.userIndicatorId).toBe('a');
  });

  it('getInstancesByPaneId filters by paneId', () => {
    const { result } = renderHook(() => useIndicatorStore());
    act(() => {
      result.current.addInstance({ userIndicatorId: 'a', catalogType: 'rsi', params: {}, visible: true, paneId: 'p1' });
      result.current.addInstance({ userIndicatorId: 'b', catalogType: 'rsi', params: {}, visible: true, paneId: 'p2' });
      result.current.addInstance({ userIndicatorId: 'c', catalogType: 'rsi', params: {}, visible: true, paneId: 'p1' });
    });
    const p1 = result.current.getInstancesByPaneId('p1');
    expect(p1.map((i) => i.userIndicatorId).sort()).toEqual(['a', 'c']);
  });

  describe('hydrate', () => {
    it('sanitizes and loads instances from preferences', () => {
      act(() => {
        useIndicatorStore.getState().hydrate({
          instances: [
            { id: 'x', userIndicatorId: 'ui-1', catalogType: 'rsi', params: { period: 14 }, visible: true },
            { userIndicatorId: 'ui-2', catalogType: 'ema', params: { period: 20 }, visible: false },
            { invalid: true },
          ],
        });
      });
      const state = useIndicatorStore.getState();
      expect(state.instances).toHaveLength(2);
      expect(state.instances[0]?.id).toBe('x');
      expect(state.instances[1]?.id).toBeTruthy();
      expect(state.instances[1]?.visible).toBe(false);
    });

    it('ignores missing instances key', () => {
      act(() => {
        useIndicatorStore.setState({
          instances: [
            { id: 'x', userIndicatorId: 'ui-1', catalogType: 'rsi', params: {}, visible: true },
          ],
        });
      });
      act(() => {
        useIndicatorStore.getState().hydrate({});
      });
      expect(useIndicatorStore.getState().instances).toHaveLength(1);
    });
  });
});
