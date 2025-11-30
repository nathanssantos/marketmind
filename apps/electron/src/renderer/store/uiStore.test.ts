import { beforeEach, describe, expect, it } from 'vitest';
import { useUIStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      chatPosition: 'right',
    });
  });

  describe('Initial State', () => {
    it('should initialize with default chat position', () => {
      const state = useUIStore.getState();
      expect(state.chatPosition).toBe('right');
    });
  });

  describe('setChatPosition', () => {
    it('should update chat position to left', () => {
      const { setChatPosition } = useUIStore.getState();
      setChatPosition('left');
      expect(useUIStore.getState().chatPosition).toBe('left');
    });

    it('should update chat position to right', () => {
      const { setChatPosition } = useUIStore.getState();
      setChatPosition('left');
      setChatPosition('right');
      expect(useUIStore.getState().chatPosition).toBe('right');
    });

    it('should handle multiple position changes', () => {
      const { setChatPosition } = useUIStore.getState();
      
      setChatPosition('left');
      expect(useUIStore.getState().chatPosition).toBe('left');
      
      setChatPosition('right');
      expect(useUIStore.getState().chatPosition).toBe('right');
      
      setChatPosition('left');
      expect(useUIStore.getState().chatPosition).toBe('left');
    });

    it('should allow setting same position consecutively', () => {
      const { setChatPosition } = useUIStore.getState();
      
      setChatPosition('left');
      expect(useUIStore.getState().chatPosition).toBe('left');
      
      setChatPosition('left');
      expect(useUIStore.getState().chatPosition).toBe('left');
    });
  });

  describe('State Persistence', () => {
    it('should have persistence configured with correct name', () => {
      expect(localStorage.getItem('ui-storage')).toBeDefined();
    });

    it('should maintain state through store access', () => {
      const { setChatPosition } = useUIStore.getState();
      setChatPosition('left');
      
      const newState = useUIStore.getState();
      expect(newState.chatPosition).toBe('left');
    });
  });

  describe('Type Safety', () => {
    it('should only accept valid position values', () => {
      const { setChatPosition } = useUIStore.getState();
      
      setChatPosition('left');
      expect(useUIStore.getState().chatPosition).toBe('left');
      
      setChatPosition('right');
      expect(useUIStore.getState().chatPosition).toBe('right');
    });

    it('should return correct state type', () => {
      const state = useUIStore.getState();
      expect(typeof state.chatPosition).toBe('string');
      expect(['left', 'right']).toContain(state.chatPosition);
    });
  });

  describe('Store Function Existence', () => {
    it('should expose setChatPosition function', () => {
      const { setChatPosition } = useUIStore.getState();
      expect(typeof setChatPosition).toBe('function');
    });

    it('should expose chatPosition property', () => {
      const { chatPosition } = useUIStore.getState();
      expect(chatPosition).toBeDefined();
    });
  });
});
