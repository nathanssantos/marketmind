import { act, renderHook } from '@testing-library/react';
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
  useProfileEditor,
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

  describe('useProfileEditor hook', () => {
    const mockProfile = {
      id: 'test-id',
      userId: 'user-id',
      name: 'Test Profile',
      description: 'Test description',
      enabledSetupTypes: ['larry-williams-9-1'],
      maxPositionSize: 10,
      maxConcurrentPositions: 3,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should initialize with empty state when profile is null', () => {
      const { result } = renderHook(() => useProfileEditor(null, true));

      expect(result.current.state.name).toBe('');
      expect(result.current.state.enabledSetupTypes).toEqual([]);
      expect(result.current.isEditing).toBe(false);
    });

    it('should initialize with profile data when provided', () => {
      const { result } = renderHook(() => useProfileEditor(mockProfile, true));

      expect(result.current.state.name).toBe('Test Profile');
      expect(result.current.state.enabledSetupTypes).toEqual(['larry-williams-9-1']);
      expect(result.current.isEditing).toBe(true);
    });

    it('should update name', () => {
      const { result } = renderHook(() => useProfileEditor(null, true));

      act(() => {
        result.current.setName('New Name');
      });

      expect(result.current.state.name).toBe('New Name');
    });

    it('should update description', () => {
      const { result } = renderHook(() => useProfileEditor(null, true));

      act(() => {
        result.current.setDescription('New Description');
      });

      expect(result.current.state.description).toBe('New Description');
    });

    it('should update isDefault', () => {
      const { result } = renderHook(() => useProfileEditor(null, true));

      act(() => {
        result.current.setIsDefault(true);
      });

      expect(result.current.state.isDefault).toBe(true);
    });

    it('should update maxPositionSize', () => {
      const { result } = renderHook(() => useProfileEditor(null, true));

      act(() => {
        result.current.setMaxPositionSize(25);
      });

      expect(result.current.state.maxPositionSize).toBe(25);
    });

    it('should update maxConcurrentPositions', () => {
      const { result } = renderHook(() => useProfileEditor(null, true));

      act(() => {
        result.current.setMaxConcurrentPositions(5);
      });

      expect(result.current.state.maxConcurrentPositions).toBe(5);
    });

    it('should toggle overridePositionSize and clear value when disabled', () => {
      const { result } = renderHook(() => useProfileEditor(null, true));

      act(() => {
        result.current.setMaxPositionSize(25);
        result.current.setOverridePositionSize(true);
      });

      expect(result.current.state.overridePositionSize).toBe(true);
      expect(result.current.state.maxPositionSize).toBe(25);

      act(() => {
        result.current.setOverridePositionSize(false);
      });

      expect(result.current.state.overridePositionSize).toBe(false);
      expect(result.current.state.maxPositionSize).toBeUndefined();
    });

    it('should toggle overrideConcurrentPositions and clear value when disabled', () => {
      const { result } = renderHook(() => useProfileEditor(null, true));

      act(() => {
        result.current.setMaxConcurrentPositions(3);
        result.current.setOverrideConcurrentPositions(true);
      });

      expect(result.current.state.overrideConcurrentPositions).toBe(true);
      expect(result.current.state.maxConcurrentPositions).toBe(3);

      act(() => {
        result.current.setOverrideConcurrentPositions(false);
      });

      expect(result.current.state.overrideConcurrentPositions).toBe(false);
      expect(result.current.state.maxConcurrentPositions).toBeUndefined();
    });

    it('should toggle setup', () => {
      const { result } = renderHook(() => useProfileEditor(null, true));

      act(() => {
        result.current.handleToggleSetup('larry-williams-9-1');
      });

      expect(result.current.state.enabledSetupTypes).toContain('larry-williams-9-1');

      act(() => {
        result.current.handleToggleSetup('larry-williams-9-1');
      });

      expect(result.current.state.enabledSetupTypes).not.toContain('larry-williams-9-1');
    });

    it('should toggle group', () => {
      const { result } = renderHook(() => useProfileEditor(null, true));

      act(() => {
        result.current.handleToggleGroup('larry-williams');
      });

      const larryWilliamsSetups = AVAILABLE_SETUPS.filter((s) => s.group === 'larry-williams').map((s) => s.id);
      for (const setupId of larryWilliamsSetups) {
        expect(result.current.state.enabledSetupTypes).toContain(setupId);
      }
    });

    it('should provide groupsWithStats', () => {
      const { result } = renderHook(() => useProfileEditor(null, true));

      expect(result.current.groupsWithStats).toHaveLength(SETUP_GROUPS.length);

      const larryWilliamsGroup = result.current.groupsWithStats.find((g) => g.id === 'larry-williams');
      expect(larryWilliamsGroup).toBeDefined();
      expect(larryWilliamsGroup?.stats.total).toBe(4);
      expect(larryWilliamsGroup?.stats.enabled).toBe(0);
    });

    it('should update groupsWithStats when setups change', () => {
      const { result } = renderHook(() => useProfileEditor(null, true));

      act(() => {
        result.current.handleToggleSetup('larry-williams-9-1');
      });

      const larryWilliamsGroup = result.current.groupsWithStats.find((g) => g.id === 'larry-williams');
      expect(larryWilliamsGroup?.stats.enabled).toBe(1);
    });

    it('should reset state when profile or isOpen changes', () => {
      const { result, rerender } = renderHook(
        ({ profile, isOpen }) => useProfileEditor(profile, isOpen),
        { initialProps: { profile: mockProfile, isOpen: true } }
      );

      act(() => {
        result.current.setName('Changed Name');
      });

      expect(result.current.state.name).toBe('Changed Name');

      rerender({ profile: mockProfile, isOpen: false });
      rerender({ profile: mockProfile, isOpen: true });

      expect(result.current.state.name).toBe('Test Profile');
    });
  });
});
