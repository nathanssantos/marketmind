import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIStudy } from '../../shared/types';
import { useAIStudies } from './useAIStudies';

vi.mock('../services/ai/AIStudyStorage', () => ({
  aiStudyStorage: {
    getStudiesForSymbol: vi.fn(),
    saveStudiesForSymbol: vi.fn(),
    deleteStudiesForSymbol: vi.fn(),
  },
}));

vi.mock('../services/ai/AIResponseParser', () => ({
  parseAIResponse: vi.fn(),
}));

import { parseAIResponse } from '../services/ai/AIResponseParser';
import { aiStudyStorage } from '../services/ai/AIStudyStorage';

describe('useAIStudies', () => {
  const symbol = 'BTCUSDT';
  const conversationId = 'conv-123';
  
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const createMockStudyLine = (id: number, type: 'support' | 'resistance' = 'support'): AIStudy => ({
    id,
    type,
    points: [
      { timestamp: Date.now(), price: 50000 },
      { timestamp: Date.now() + 1000, price: 50000 },
    ],
    visible: true,
  });

  describe('initial state', () => {
    it('should start with empty studies when no data exists', async () => {
      vi.mocked(aiStudyStorage.getStudiesForSymbol).mockResolvedValue(null);

      const { result } = renderHook(() => useAIStudies({ symbol }));

      await vi.waitFor(() => {
        expect(result.current.studies).toEqual([]);
        expect(result.current.hasStudies).toBe(false);
        expect(result.current.studiesVisible).toBe(false);
        expect(result.current.studyDataId).toBeNull();
      });
    });

    it('should load existing studies from storage', async () => {
      const mockStudies: AIStudy[] = [createMockStudyLine(1)];

      vi.mocked(aiStudyStorage.getStudiesForSymbol).mockResolvedValue({
        id: 'test-id',
        symbol,
        createdAt: Date.now(),
        studies: mockStudies,
      });

      const { result } = renderHook(() => useAIStudies({ symbol }));

      await vi.waitFor(() => {
        expect(result.current.studies).toEqual(mockStudies);
        expect(result.current.hasStudies).toBe(true);
        expect(result.current.studiesVisible).toBe(true);
        expect(result.current.studyDataId).toBe('test-id');
      });
    });

    it('should use conversationId as storage key when provided', async () => {
      vi.mocked(aiStudyStorage.getStudiesForSymbol).mockResolvedValue(null);

      renderHook(() => useAIStudies({ symbol, conversationId }));

      await vi.waitFor(() => {
        expect(aiStudyStorage.getStudiesForSymbol).toHaveBeenCalledWith(conversationId);
      });
    });

    it('should use symbol as storage key when conversationId is not provided', async () => {
      vi.mocked(aiStudyStorage.getStudiesForSymbol).mockResolvedValue(null);

      renderHook(() => useAIStudies({ symbol }));

      await vi.waitFor(() => {
        expect(aiStudyStorage.getStudiesForSymbol).toHaveBeenCalledWith(symbol);
      });
    });
  });

  describe('saveStudies', () => {
    it('should save new studies to storage', async () => {
      vi.mocked(aiStudyStorage.getStudiesForSymbol).mockResolvedValue(null);
      vi.mocked(aiStudyStorage.saveStudiesForSymbol).mockResolvedValue();

      const { result } = renderHook(() => useAIStudies({ symbol }));

      const newStudies: AIStudy[] = [createMockStudyLine(1, 'resistance')];

      await act(async () => {
        await result.current.saveStudies(newStudies);
      });

      expect(aiStudyStorage.saveStudiesForSymbol).toHaveBeenCalledWith(
        symbol,
        expect.objectContaining({
          symbol,
          studies: newStudies,
        })
      );
      expect(result.current.studies).toEqual(newStudies);
      expect(result.current.hasStudies).toBe(true);
    });
  });

  describe('deleteStudies', () => {
    it('should delete studies from storage', async () => {
      const mockStudies: AIStudy[] = [createMockStudyLine(1)];

      vi.mocked(aiStudyStorage.getStudiesForSymbol).mockResolvedValue({
        id: 'test-id',
        symbol,
        createdAt: Date.now(),
        studies: mockStudies,
      });
      vi.mocked(aiStudyStorage.deleteStudiesForSymbol).mockResolvedValue();

      const { result } = renderHook(() => useAIStudies({ symbol }));

      await vi.waitFor(() => {
        expect(result.current.hasStudies).toBe(true);
      });

      await act(async () => {
        await result.current.deleteStudies();
      });

      expect(aiStudyStorage.deleteStudiesForSymbol).toHaveBeenCalledWith(symbol);
      expect(result.current.studies).toEqual([]);
      expect(result.current.hasStudies).toBe(false);
    });
  });

  describe('toggleStudiesVisibility', () => {
    it('should toggle visibility of all studies', async () => {
      const mockStudies: AIStudy[] = [
        createMockStudyLine(1, 'support'),
        createMockStudyLine(2, 'resistance'),
      ];

      vi.mocked(aiStudyStorage.getStudiesForSymbol).mockResolvedValue({
        id: 'test-id',
        symbol,
        createdAt: Date.now(),
        studies: mockStudies,
      });

      const { result } = renderHook(() => useAIStudies({ symbol }));

      await vi.waitFor(() => {
        expect(result.current.studiesVisible).toBe(true);
      });

      act(() => {
        result.current.toggleStudiesVisibility();
      });

      expect(result.current.studies.every((s) => s.visible === false)).toBe(true);
      expect(result.current.studiesVisible).toBe(false);

      act(() => {
        result.current.toggleStudiesVisibility();
      });

      expect(result.current.studies.every((s) => s.visible === true)).toBe(true);
      expect(result.current.studiesVisible).toBe(true);
    });
  });

  describe('processAIResponse', () => {
    it('should process AI response and extract studies when no studies exist', async () => {
      vi.mocked(aiStudyStorage.getStudiesForSymbol).mockResolvedValue(null);
      vi.mocked(aiStudyStorage.saveStudiesForSymbol).mockResolvedValue();

      const newStudies: AIStudy[] = [createMockStudyLine(1)];

      vi.mocked(parseAIResponse).mockReturnValue({
        analysis: 'This is the analysis text',
        studies: newStudies,
      });

      const { result } = renderHook(() => useAIStudies({ symbol }));

      let processedText: string = '';
      await act(async () => {
        processedText = await result.current.processAIResponse(
          'AI response with studies'
        );
      });

      expect(parseAIResponse).toHaveBeenCalledWith('AI response with studies');
      expect(processedText).toBe('This is the analysis text');
      expect(result.current.studies).toEqual(newStudies);
      expect(result.current.hasStudies).toBe(true);
    });

    it('should append new studies to existing ones', async () => {
      const existingStudies: AIStudy[] = [createMockStudyLine(1, 'support')];

      vi.mocked(aiStudyStorage.getStudiesForSymbol).mockResolvedValue({
        id: 'test-id',
        symbol,
        createdAt: Date.now(),
        studies: existingStudies,
      });
      vi.mocked(aiStudyStorage.saveStudiesForSymbol).mockResolvedValue();

      const newStudies: AIStudy[] = [createMockStudyLine(2, 'resistance')];

      vi.mocked(parseAIResponse).mockReturnValue({
        analysis: 'New analysis with more studies',
        studies: newStudies,
      });

      const { result } = renderHook(() => useAIStudies({ symbol }));

      await vi.waitFor(() => {
        expect(result.current.studies).toEqual(existingStudies);
      });

      let processedText: string = '';
      await act(async () => {
        processedText = await result.current.processAIResponse(
          'AI response with new studies'
        );
      });

      expect(parseAIResponse).toHaveBeenCalledWith('AI response with new studies');
      expect(processedText).toBe('New analysis with more studies');
      expect(result.current.studies).toEqual([...existingStudies, ...newStudies]);
      expect(result.current.hasStudies).toBe(true);
    });

    it('should return analysis text when no studies in response', async () => {
      vi.mocked(aiStudyStorage.getStudiesForSymbol).mockResolvedValue(null);

      vi.mocked(parseAIResponse).mockReturnValue({
        analysis: 'Analysis without studies',
        studies: [],
      });

      const { result } = renderHook(() => useAIStudies({ symbol }));

      let processedText: string = '';
      await act(async () => {
        processedText = await result.current.processAIResponse(
          'AI response without studies'
        );
      });

      expect(processedText).toBe('Analysis without studies');
      expect(result.current.studies).toEqual([]);
      expect(result.current.hasStudies).toBe(false);
    });
  });

  describe('symbol change', () => {
    it('should reload studies when symbol changes', async () => {
      const btcStudies: AIStudy[] = [createMockStudyLine(1, 'support')];
      const ethStudies: AIStudy[] = [createMockStudyLine(2, 'resistance')];

      vi.mocked(aiStudyStorage.getStudiesForSymbol).mockImplementation(async (sym) => {
        if (sym === 'BTCUSDT') {
          return {
            id: 'btc-id',
            symbol: 'BTCUSDT',
            createdAt: Date.now(),
            studies: btcStudies,
          };
        }
        if (sym === 'ETHUSDT') {
          return {
            id: 'eth-id',
            symbol: 'ETHUSDT',
            createdAt: Date.now(),
            studies: ethStudies,
          };
        }
        return null;
      });

      const { result, rerender } = renderHook(
        ({ symbol }) => useAIStudies({ symbol }),
        {
          initialProps: { symbol: 'BTCUSDT' },
        }
      );

      await vi.waitFor(() => {
        expect(result.current.studies).toEqual(btcStudies);
      });

      rerender({ symbol: 'ETHUSDT' });

      await vi.waitFor(() => {
        expect(result.current.studies).toEqual(ethStudies);
      });
    });
  });
});
