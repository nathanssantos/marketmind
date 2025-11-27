import type { AIStudyData } from '@shared/types';

class AIStudyStorageService {
  async getStudiesForSymbol(symbol: string): Promise<AIStudyData | null> {
    try {
      const result = await window.electron.secureStorage.getAIStudiesForSymbol(symbol);
      return result.success ? result.data : null;
    } catch (error) {
      console.error('Error loading AI studies for symbol:', error);
      return null;
    }
  }

  async saveStudiesForSymbol(symbol: string, data: AIStudyData): Promise<void> {
    try {
      await window.electron.secureStorage.setAIStudiesForSymbol(symbol, data);
    } catch (error) {
      console.error('Error saving AI studies for symbol:', error);
    }
  }

  async deleteStudiesForSymbol(symbol: string): Promise<void> {
    try {
      await window.electron.secureStorage.deleteAIStudiesForSymbol(symbol);
    } catch (error) {
      console.error('Error deleting AI studies for symbol:', error);
    }
  }

  async hasStudiesForSymbol(symbol: string): Promise<boolean> {
    const studies = await this.getStudiesForSymbol(symbol);
    return studies !== null && studies.studies.length > 0;
  }

  async clearAllStudies(): Promise<void> {
    try {
      await window.electron.secureStorage.clearAIStudies();
    } catch (error) {
      console.error('Error clearing AI studies:', error);
    }
  }
}

export const aiStudyStorage = new AIStudyStorageService();
