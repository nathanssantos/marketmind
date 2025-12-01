import type { Pattern, PatternStorage } from '@shared/types/pattern';

const STORAGE_PREFIX = 'marketmind:patterns';

class PatternStorageService {
  private getStorageKey(symbol: string): string {
    return `${STORAGE_PREFIX}:${symbol}`;
  }

  async getPatterns(symbol: string): Promise<Pattern[]> {
    try {
      const key = this.getStorageKey(symbol);
      const stored = localStorage.getItem(key);
      
      if (!stored) return [];
      
      const data: PatternStorage = JSON.parse(stored);
      return data.patterns || [];
    } catch (error) {
      console.error('[PatternStorage] Error loading patterns:', error);
      return [];
    }
  }

  async savePatterns(symbol: string, patterns: Pattern[]): Promise<void> {
    try {
      const key = this.getStorageKey(symbol);
      const data: PatternStorage = {
        symbol,
        patterns,
        updatedAt: Date.now(),
      };
      
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('[PatternStorage] Error saving patterns:', error);
      throw error;
    }
  }

  async deletePattern(symbol: string, patternId: number): Promise<void> {
    try {
      const patterns = await this.getPatterns(symbol);
      const filtered = patterns.filter(p => p.id !== patternId);
      await this.savePatterns(symbol, filtered);
    } catch (error) {
      console.error('[PatternStorage] Error deleting pattern:', error);
      throw error;
    }
  }

  async deleteAllPatterns(symbol: string): Promise<void> {
    try {
      const key = this.getStorageKey(symbol);
      localStorage.removeItem(key);
    } catch (error) {
      console.error('[PatternStorage] Error deleting all patterns:', error);
      throw error;
    }
  }

  async deletePatternsBySource(symbol: string, source: 'algorithm' | 'ai'): Promise<void> {
    try {
      const patterns = await this.getPatterns(symbol);
      const filtered = patterns.filter(p => p.source !== source);
      await this.savePatterns(symbol, filtered);
    } catch (error) {
      console.error('[PatternStorage] Error deleting patterns by source:', error);
      throw error;
    }
  }
}

export const patternStorage = new PatternStorageService();
