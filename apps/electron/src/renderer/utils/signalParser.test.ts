import { describe, expect, it } from 'vitest';
import { parseSignalFromResponse } from './signalParser';

describe('signalParser', () => {
  describe('parseSignalFromResponse', () => {
    it('should return null for text without signal', () => {
      const result = parseSignalFromResponse('Just some analysis text');
      expect(result).toBeNull();
    });

    it('should parse STRONG_BUY with underscore', () => {
      const text = '**Current Signal**: STRONG_BUY\n**Confidence**: 85%';
      const result = parseSignalFromResponse(text);

      expect(result).toEqual({
        signal: 'strong_buy',
        confidence: 85,
      });
    });

    it('should parse STRONG BUY with space', () => {
      const text = '**Current Signal**: STRONG BUY\n**Confidence**: 90%';
      const result = parseSignalFromResponse(text);

      expect(result).toEqual({
        signal: 'strong_buy',
        confidence: 90,
      });
    });

    it('should parse BUY signal', () => {
      const text = '**Current Signal**: BUY\n**Confidence**: 75%';
      const result = parseSignalFromResponse(text);

      expect(result).toEqual({
        signal: 'buy',
        confidence: 75,
      });
    });

    it('should parse HOLD signal', () => {
      const text = '**Current Signal**: HOLD\n**Confidence**: 60%';
      const result = parseSignalFromResponse(text);

      expect(result).toEqual({
        signal: 'hold',
        confidence: 60,
      });
    });

    it('should parse SELL signal', () => {
      const text = '**Current Signal**: SELL\n**Confidence**: 70%';
      const result = parseSignalFromResponse(text);

      expect(result).toEqual({
        signal: 'sell',
        confidence: 70,
      });
    });

    it('should parse STRONG_SELL with underscore', () => {
      const text = '**Current Signal**: STRONG_SELL\n**Confidence**: 95%';
      const result = parseSignalFromResponse(text);

      expect(result).toEqual({
        signal: 'strong_sell',
        confidence: 95,
      });
    });

    it('should parse STRONG SELL with space', () => {
      const text = '**Current Signal**: STRONG SELL\n**Confidence**: 88%';
      const result = parseSignalFromResponse(text);

      expect(result).toEqual({
        signal: 'strong_sell',
        confidence: 88,
      });
    });

    it('should handle lowercase signal', () => {
      const text = '**Current Signal**: buy\n**Confidence**: 65%';
      const result = parseSignalFromResponse(text);

      expect(result).toEqual({
        signal: 'buy',
        confidence: 65,
      });
    });

    it('should handle mixed case signal', () => {
      const text = '**Current Signal**: StRoNg_BuY\n**Confidence**: 80%';
      const result = parseSignalFromResponse(text);

      expect(result).toEqual({
        signal: 'strong_buy',
        confidence: 80,
      });
    });

    it('should default confidence to 50 when not provided', () => {
      const text = '**Current Signal**: BUY';
      const result = parseSignalFromResponse(text);

      expect(result).toEqual({
        signal: 'buy',
        confidence: 50,
      });
    });

    it('should parse confidence without percent sign', () => {
      const text = '**Current Signal**: SELL\n**Confidence**: 72';
      const result = parseSignalFromResponse(text);

      expect(result).toEqual({
        signal: 'sell',
        confidence: 72,
      });
    });

    it('should handle signal without colon', () => {
      const text = '**Current Signal** HOLD\n**Confidence** 55%';
      const result = parseSignalFromResponse(text);

      expect(result).toEqual({
        signal: 'hold',
        confidence: 55,
      });
    });

    it('should handle extra whitespace', () => {
      const text = '**Current Signal**:    BUY   \n**Confidence**:   78%  ';
      const result = parseSignalFromResponse(text);

      expect(result).toEqual({
        signal: 'buy',
        confidence: 78,
      });
    });

    it('should work with signal in middle of text', () => {
      const text = `
        Based on the analysis...
        
        **Current Signal**: STRONG_BUY
        **Confidence**: 92%
        
        This is because...
      `;
      const result = parseSignalFromResponse(text);

      expect(result).toEqual({
        signal: 'strong_buy',
        confidence: 92,
      });
    });

    it('should return null for invalid signal text', () => {
      const text = '**Current Signal**: MAYBE\n**Confidence**: 50%';
      const result = parseSignalFromResponse(text);

      expect(result).toBeNull();
    });

    it('should handle confidence at boundaries', () => {
      const text1 = '**Current Signal**: BUY\n**Confidence**: 0%';
      const result1 = parseSignalFromResponse(text1);
      expect(result1?.confidence).toBe(0);

      const text2 = '**Current Signal**: BUY\n**Confidence**: 100%';
      const result2 = parseSignalFromResponse(text2);
      expect(result2?.confidence).toBe(100);
    });

    it('should default confidence to 50 when match exists but value is empty', () => {
      const text = '**Current Signal**: BUY\n**Confidence**: %';
      const result = parseSignalFromResponse(text);

      expect(result).toEqual({
        signal: 'buy',
        confidence: 50,
      });
    });

    it('should handle multiple spaces in STRONG SELL', () => {
      const text = '**Current Signal**: STRONG   SELL\n**Confidence**: 85%';
      const result = parseSignalFromResponse(text);

      expect(result).toEqual({
        signal: 'strong_sell',
        confidence: 85,
      });
    });

    it('should work with different markdown formatting', () => {
      const text = '## Current Signal: BUY\n## Confidence: 70%';
      const result = parseSignalFromResponse(text);

      expect(result).toBeNull();
    });

    it('should require bold markers for signal', () => {
      const text = 'Current Signal: BUY\nConfidence: 70%';
      const result = parseSignalFromResponse(text);

      expect(result).toBeNull();
    });

    it('should parse signal case-insensitively', () => {
      const variations = [
        'buy',
        'BUY',
        'Buy',
        'bUy',
      ];

      variations.forEach((variation) => {
        const text = `**Current Signal**: ${variation}\n**Confidence**: 75%`;
        const result = parseSignalFromResponse(text);
        expect(result?.signal).toBe('buy');
      });
    });

    it('should handle STRONG BUY variations', () => {
      const variations = [
        'STRONG_BUY',
        'STRONG BUY',
        'strong_buy',
        'strong buy',
        'Strong Buy',
        'STRONG  BUY',
      ];

      variations.forEach((variation) => {
        const text = `**Current Signal**: ${variation}\n**Confidence**: 85%`;
        const result = parseSignalFromResponse(text);
        expect(result?.signal).toBe('strong_buy');
      });
    });

    it('should handle STRONG SELL variations', () => {
      const variations = [
        'STRONG_SELL',
        'STRONG SELL',
        'strong_sell',
        'strong sell',
        'Strong Sell',
        'STRONG  SELL',
      ];

      variations.forEach((variation) => {
        const text = `**Current Signal**: ${variation}\n**Confidence**: 90%`;
        const result = parseSignalFromResponse(text);
        expect(result?.signal).toBe('strong_sell');
      });
    });
  });
});
