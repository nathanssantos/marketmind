import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_SETUPS,
  SETUP_GROUPS,
  buildCreateInput,
  buildUpdateInput,
  canSubmitProfile,
  getGroupStats,
  getInitialState,
  toggleGroup,
  toggleSetup,
  type ProfileEditorState,
} from './useProfileEditor';

describe('useProfileEditor', () => {
  describe('getInitialState', () => {
    it('should return empty state when profile is null', () => {
      const state = getInitialState(null);

      expect(state).toEqual({
        name: '',
        description: '',
        enabledSetupTypes: [],
        maxPositionSize: undefined,
        maxConcurrentPositions: undefined,
        isDefault: false,
        overridePositionSize: false,
        overrideConcurrentPositions: false,
      });
    });

    it('should populate state from profile', () => {
      const profile = {
        id: 'test-id',
        userId: 'user-id',
        name: 'Test Profile',
        description: 'Test description',
        enabledSetupTypes: ['larry-williams-9-1', 'keltner-breakout-optimized'],
        maxPositionSize: 10,
        maxConcurrentPositions: 3,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const state = getInitialState(profile);

      expect(state).toEqual({
        name: 'Test Profile',
        description: 'Test description',
        enabledSetupTypes: ['larry-williams-9-1', 'keltner-breakout-optimized'],
        maxPositionSize: 10,
        maxConcurrentPositions: 3,
        isDefault: true,
        overridePositionSize: true,
        overrideConcurrentPositions: true,
      });
    });

    it('should handle profile with null optional fields', () => {
      const profile = {
        id: 'test-id',
        userId: 'user-id',
        name: 'Minimal Profile',
        description: null,
        enabledSetupTypes: ['larry-williams-9-1'],
        maxPositionSize: null,
        maxConcurrentPositions: null,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const state = getInitialState(profile);

      expect(state.description).toBe('');
      expect(state.maxPositionSize).toBeUndefined();
      expect(state.maxConcurrentPositions).toBeUndefined();
      expect(state.overridePositionSize).toBe(false);
      expect(state.overrideConcurrentPositions).toBe(false);
    });
  });

  describe('toggleSetup', () => {
    it('should add setup when not present', () => {
      const result = toggleSetup([], 'larry-williams-9-1');
      expect(result).toEqual(['larry-williams-9-1']);
    });

    it('should remove setup when present', () => {
      const result = toggleSetup(['larry-williams-9-1', 'larry-williams-9-2'], 'larry-williams-9-1');
      expect(result).toEqual(['larry-williams-9-2']);
    });

    it('should add to existing setups', () => {
      const result = toggleSetup(['larry-williams-9-1'], 'keltner-breakout-optimized');
      expect(result).toEqual(['larry-williams-9-1', 'keltner-breakout-optimized']);
    });

    it('should return empty array when removing last setup', () => {
      const result = toggleSetup(['larry-williams-9-1'], 'larry-williams-9-1');
      expect(result).toEqual([]);
    });
  });

  describe('toggleGroup', () => {
    it('should enable all setups in group when none enabled', () => {
      const result = toggleGroup([], 'larry-williams');
      const larryWilliamsSetups = AVAILABLE_SETUPS.filter((s) => s.group === 'larry-williams').map((s) => s.id);

      expect(result).toEqual(expect.arrayContaining(larryWilliamsSetups));
      expect(result.length).toBe(larryWilliamsSetups.length);
    });

    it('should enable all setups in group when some enabled', () => {
      const result = toggleGroup(['larry-williams-9-1'], 'larry-williams');
      const larryWilliamsSetups = AVAILABLE_SETUPS.filter((s) => s.group === 'larry-williams').map((s) => s.id);

      expect(result).toEqual(expect.arrayContaining(larryWilliamsSetups));
    });

    it('should disable all setups in group when all enabled', () => {
      const allLarryWilliams = ['larry-williams-9-1', 'larry-williams-9-2', 'larry-williams-9-3', 'larry-williams-9-4'];
      const result = toggleGroup(allLarryWilliams, 'larry-williams');

      expect(result).toEqual([]);
    });

    it('should preserve setups from other groups', () => {
      const initial = ['keltner-breakout-optimized'];
      const result = toggleGroup(initial, 'larry-williams');

      expect(result).toContain('keltner-breakout-optimized');
      expect(result).toContain('larry-williams-9-1');
    });

    it('should only remove setups from target group', () => {
      const allLarryWilliams = ['larry-williams-9-1', 'larry-williams-9-2', 'larry-williams-9-3', 'larry-williams-9-4'];
      const initial = [...allLarryWilliams, 'keltner-breakout-optimized'];
      const result = toggleGroup(initial, 'larry-williams');

      expect(result).toEqual(['keltner-breakout-optimized']);
    });
  });

  describe('getGroupStats', () => {
    it('should return correct stats when no setups enabled', () => {
      const stats = getGroupStats([], 'larry-williams');

      expect(stats.total).toBe(4);
      expect(stats.enabled).toBe(0);
      expect(stats.allEnabled).toBe(false);
      expect(stats.noneEnabled).toBe(true);
    });

    it('should return correct stats when some setups enabled', () => {
      const stats = getGroupStats(['larry-williams-9-1', 'larry-williams-9-2'], 'larry-williams');

      expect(stats.total).toBe(4);
      expect(stats.enabled).toBe(2);
      expect(stats.allEnabled).toBe(false);
      expect(stats.noneEnabled).toBe(false);
    });

    it('should return correct stats when all setups enabled', () => {
      const allLarryWilliams = ['larry-williams-9-1', 'larry-williams-9-2', 'larry-williams-9-3', 'larry-williams-9-4'];
      const stats = getGroupStats(allLarryWilliams, 'larry-williams');

      expect(stats.total).toBe(4);
      expect(stats.enabled).toBe(4);
      expect(stats.allEnabled).toBe(true);
      expect(stats.noneEnabled).toBe(false);
    });

    it('should not count setups from other groups', () => {
      const stats = getGroupStats(['keltner-breakout-optimized'], 'larry-williams');

      expect(stats.enabled).toBe(0);
      expect(stats.noneEnabled).toBe(true);
    });

    it('should work for all groups', () => {
      for (const group of SETUP_GROUPS) {
        const groupSetups = AVAILABLE_SETUPS.filter((s) => s.group === group.id);
        const stats = getGroupStats(groupSetups.map((s) => s.id), group.id);

        expect(stats.total).toBe(groupSetups.length);
        expect(stats.allEnabled).toBe(true);
      }
    });
  });

  describe('canSubmitProfile', () => {
    const validState: ProfileEditorState = {
      name: 'Test Profile',
      description: '',
      enabledSetupTypes: ['larry-williams-9-1'],
      maxPositionSize: undefined,
      maxConcurrentPositions: undefined,
      isDefault: false,
      overridePositionSize: false,
      overrideConcurrentPositions: false,
    };

    it('should return true for valid state', () => {
      expect(canSubmitProfile(validState, false)).toBe(true);
    });

    it('should return false when name is empty', () => {
      expect(canSubmitProfile({ ...validState, name: '' }, false)).toBe(false);
    });

    it('should return false when name is only whitespace', () => {
      expect(canSubmitProfile({ ...validState, name: '   ' }, false)).toBe(false);
    });

    it('should return false when no setups enabled', () => {
      expect(canSubmitProfile({ ...validState, enabledSetupTypes: [] }, false)).toBe(false);
    });

    it('should return false when submitting', () => {
      expect(canSubmitProfile(validState, true)).toBe(false);
    });

    it('should return true with minimal valid data', () => {
      const minimalState: ProfileEditorState = {
        name: 'a',
        description: '',
        enabledSetupTypes: ['larry-williams-9-1'],
        maxPositionSize: undefined,
        maxConcurrentPositions: undefined,
        isDefault: false,
        overridePositionSize: false,
        overrideConcurrentPositions: false,
      };
      expect(canSubmitProfile(minimalState, false)).toBe(true);
    });
  });

  describe('buildCreateInput', () => {
    it('should build input with required fields only', () => {
      const state: ProfileEditorState = {
        name: '  Test Profile  ',
        description: '',
        enabledSetupTypes: ['larry-williams-9-1', 'larry-williams-9-2'],
        maxPositionSize: undefined,
        maxConcurrentPositions: undefined,
        isDefault: false,
        overridePositionSize: false,
        overrideConcurrentPositions: false,
      };

      const input = buildCreateInput(state);

      expect(input).toEqual({
        name: 'Test Profile',
        description: undefined,
        enabledSetupTypes: ['larry-williams-9-1', 'larry-williams-9-2'],
        maxPositionSize: undefined,
        maxConcurrentPositions: undefined,
        isDefault: false,
      });
    });

    it('should include description when provided', () => {
      const state: ProfileEditorState = {
        name: 'Test',
        description: '  A description  ',
        enabledSetupTypes: ['larry-williams-9-1'],
        maxPositionSize: undefined,
        maxConcurrentPositions: undefined,
        isDefault: false,
        overridePositionSize: false,
        overrideConcurrentPositions: false,
      };

      const input = buildCreateInput(state);

      expect(input.description).toBe('A description');
    });

    it('should include risk overrides when enabled', () => {
      const state: ProfileEditorState = {
        name: 'Test',
        description: '',
        enabledSetupTypes: ['larry-williams-9-1'],
        maxPositionSize: 15,
        maxConcurrentPositions: 5,
        isDefault: true,
        overridePositionSize: true,
        overrideConcurrentPositions: true,
      };

      const input = buildCreateInput(state);

      expect(input.maxPositionSize).toBe(15);
      expect(input.maxConcurrentPositions).toBe(5);
      expect(input.isDefault).toBe(true);
    });

    it('should not include risk overrides when disabled', () => {
      const state: ProfileEditorState = {
        name: 'Test',
        description: '',
        enabledSetupTypes: ['larry-williams-9-1'],
        maxPositionSize: 15,
        maxConcurrentPositions: 5,
        isDefault: false,
        overridePositionSize: false,
        overrideConcurrentPositions: false,
      };

      const input = buildCreateInput(state);

      expect(input.maxPositionSize).toBeUndefined();
      expect(input.maxConcurrentPositions).toBeUndefined();
    });
  });

  describe('buildUpdateInput', () => {
    it('should build update input same as create input', () => {
      const state: ProfileEditorState = {
        name: 'Updated Profile',
        description: 'Updated description',
        enabledSetupTypes: ['keltner-breakout-optimized'],
        maxPositionSize: 20,
        maxConcurrentPositions: undefined,
        isDefault: true,
        overridePositionSize: true,
        overrideConcurrentPositions: false,
      };

      const input = buildUpdateInput(state);

      expect(input).toEqual({
        name: 'Updated Profile',
        description: 'Updated description',
        enabledSetupTypes: ['keltner-breakout-optimized'],
        maxPositionSize: 20,
        maxConcurrentPositions: undefined,
        isDefault: true,
      });
    });
  });

  describe('AVAILABLE_SETUPS', () => {
    it('should have unique IDs', () => {
      const ids = AVAILABLE_SETUPS.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid group references', () => {
      const validGroups = SETUP_GROUPS.map((g) => g.id);
      for (const setup of AVAILABLE_SETUPS) {
        expect(validGroups).toContain(setup.group);
      }
    });
  });

  describe('SETUP_GROUPS', () => {
    it('should have unique IDs', () => {
      const ids = SETUP_GROUPS.map((g) => g.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('each group should have at least one setup', () => {
      for (const group of SETUP_GROUPS) {
        const setups = AVAILABLE_SETUPS.filter((s) => s.group === group.id);
        expect(setups.length).toBeGreaterThan(0);
      }
    });
  });
});
