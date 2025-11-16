import type { AIStudyData } from '@shared/types';

const STORAGE_KEY = 'marketmind-ai-studies';

class AIStudyStorageService {
  private getAllStudies(): Record<string, AIStudyData> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error loading AI studies:', error);
      return {};
    }
  }

  private saveAllStudies(studies: Record<string, AIStudyData>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(studies));
    } catch (error) {
      console.error('Error saving AI studies:', error);
    }
  }

  getStudiesForSymbol(symbol: string): AIStudyData | null {
    const allStudies = this.getAllStudies();
    return allStudies[symbol] || null;
  }

  saveStudiesForSymbol(symbol: string, data: AIStudyData): void {
    const allStudies = this.getAllStudies();
    allStudies[symbol] = data;
    this.saveAllStudies(allStudies);
  }

  deleteStudiesForSymbol(symbol: string): void {
    const allStudies = this.getAllStudies();
    delete allStudies[symbol];
    this.saveAllStudies(allStudies);
  }

  hasStudiesForSymbol(symbol: string): boolean {
    const studies = this.getStudiesForSymbol(symbol);
    return studies !== null && studies.studies.length > 0;
  }

  clearAllStudies(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const aiStudyStorage = new AIStudyStorageService();
