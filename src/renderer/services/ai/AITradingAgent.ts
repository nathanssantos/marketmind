import type {
  AITrade,
  AITradingConfig,
  AITradingDecision,
  Candle,
} from '@shared/types';
import { nanoid } from 'nanoid';
import { AIService } from './AIService';
import tradingPrompts from './prompts-trading.json';
import type { ChartData } from '@/renderer/store/aiStore';
import { optimizeCandles } from '@/renderer/utils/candleOptimizer';

export interface AITradingAgentConfig {
  config: AITradingConfig;
  onTrade?: (trade: AITrade) => void;
  onError?: (error: Error) => void;
  getCurrentPrice: () => number | null;
  getChartData: () => ChartData | null;
  getWalletBalance: () => number;
  executeTrade: (decision: AITradingDecision, quantity: number) => Promise<string | null>;
}

export class AITradingAgent {
  private config: AITradingConfig;
  private aiService: AIService | null = null;
  private analysisInterval: NodeJS.Timeout | null = null;
  private lastAnalysisTime: Date | null = null;
  private tradesCountToday: number = 0;
  private tradesCountThisHour: number = 0;
  private consecutiveLosses: number = 0;
  private dailyLoss: number = 0;
  private isRunning: boolean = false;

  private onTrade?: (trade: AITrade) => void;
  private onError?: (error: Error) => void;
  private readonly getCurrentPrice: () => number | null;
  private readonly getChartData: () => ChartData | null;
  private readonly getWalletBalance: () => number;
  private readonly executeTrade: (decision: AITradingDecision, quantity: number) => Promise<string | null>;

  constructor(agentConfig: AITradingAgentConfig) {
    this.config = agentConfig.config;
    if (agentConfig.onTrade) this.onTrade = agentConfig.onTrade;
    if (agentConfig.onError) this.onError = agentConfig.onError;
    this.getCurrentPrice = agentConfig.getCurrentPrice;
    this.getChartData = agentConfig.getChartData;
    this.getWalletBalance = agentConfig.getWalletBalance;
    this.executeTrade = agentConfig.executeTrade;
  }

  async start(aiService: AIService): Promise<void> {
    if (this.isRunning) {
      throw new Error('Trading agent is already running');
    }

    this.aiService = aiService;
    this.isRunning = true;
    this.resetDailyCounters();

    const intervalMs = this.getIntervalMs();
    this.analysisInterval = setInterval(() => {
      this.analyze().catch((error) => {
        console.error('Analysis error:', error);
        this.onError?.(error instanceof Error ? error : new Error(String(error)));
      });
    }, intervalMs);

    await this.analyze();
  }

  stop(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    this.isRunning = false;
  }

  updateConfig(newConfig: Partial<AITradingConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (this.isRunning && this.analysisInterval) {
      clearInterval(this.analysisInterval);
      const intervalMs = this.getIntervalMs();
      this.analysisInterval = setInterval(() => {
        this.analyze().catch((error) => {
          console.error('Analysis error:', error);
          this.onError?.(error instanceof Error ? error : new Error(String(error)));
        });
      }, intervalMs);
    }
  }

  private async analyze(): Promise<void> {
    if (!this.aiService) {
      throw new Error('AI service not initialized');
    }

    if (this.checkEmergencyStop()) {
      this.stop();
      return;
    }

    const chartData = this.getChartData();
    if (!chartData || chartData.candles.length === 0) {
      return;
    }

    if (!this.shouldAnalyze(chartData.candles)) {
      return;
    }

    try {
      const decision = await this.getAIDecision(chartData);

      if (decision.action === 'hold') {
        return;
      }

      if (!this.validateTrade(decision)) {
        return;
      }

      const quantity = this.calculatePositionSize(decision);
      if (quantity <= 0) {
        return;
      }

      const orderId = await this.executeTrade(decision, quantity);
      if (!orderId) {
        throw new Error('Failed to execute trade');
      }

      const trade: AITrade = {
        id: nanoid(),
        timestamp: new Date(),
        symbol: chartData.symbol,
        timeframe: chartData.timeframe,
        action: decision.action === 'buy' ? 'buy' : 'sell',
        entryPrice: decision.entryPrice,
        quantity,
        stopLoss: decision.stopLoss,
        takeProfit: decision.takeProfit,
        confidence: decision.confidence,
        reason: decision.reason,
        patterns: decision.patterns,
        status: 'open',
        aiModel: this.aiService.getConfig().model || 'unknown',
        aiProvider: this.aiService.getProviderType(),
        analysisTokens: 0,
        orderId,
      };

      this.onTrade?.(trade);
      this.updateTradeCounters();
      this.lastAnalysisTime = new Date();
    } catch (error) {
      console.error('Trading analysis error:', error);
      this.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async getAIDecision(chartData: ChartData): Promise<AITradingDecision> {
    if (!this.aiService) {
      throw new Error('AI service not initialized');
    }

    const optimizedCandles = optimizeCandles(chartData.candles);
    
    const prompt = this.buildTradingPrompt(chartData, optimizedCandles);

    const response = await this.aiService.sendMessage([
      {
        id: nanoid(),
        role: 'user',
        content: prompt,
        timestamp: Date.now(),
      },
    ]);

    const decision = this.parseAIResponse(response.text);
    decision.entryPrice = this.getCurrentPrice() || decision.entryPrice;

    return decision;
  }

  private buildTradingPrompt(chartData: ChartData, optimizedCandles: ReturnType<typeof optimizeCandles>): string {
    const profile = this.config.riskProfile;
    const systemPrompt = tradingPrompts.trading.system;
    const profileAddition = tradingPrompts.trading[profile].systemAddition;
    const analysisPrompt = tradingPrompts.trading[profile].analysis;

    const candlesData = JSON.stringify({
      detailed: optimizedCandles.detailed,
      simplified: optimizedCandles.simplified,
      timestampInfo: optimizedCandles.timestampInfo,
    });

    const chartInfo = `
Symbol: ${chartData.symbol}
Timeframe: ${chartData.timeframe}
Chart Type: ${chartData.chartType}
Current Price: ${this.getCurrentPrice()}
Volume Visible: ${chartData.showVolume}
Moving Averages: ${chartData.movingAverages.map(ma => `${ma.type}(${ma.period})`).join(', ')}

Candle Data:
${candlesData}
`;

    return `${systemPrompt}\n${profileAddition}\n\n${analysisPrompt}\n\n${chartInfo}`;
  }

  private parseAIResponse(responseText: string): AITradingDecision {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const decision = JSON.parse(jsonMatch[0]) as AITradingDecision;

      if (!decision.action || !decision.confidence || !decision.entryPrice) {
        throw new Error('Invalid decision format');
      }

      return decision;
    } catch (error) {
      console.error('Failed to parse AI response:', responseText);
      throw new Error(`Failed to parse AI decision: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private validateTrade(decision: AITradingDecision): boolean {
    const thresholds = this.getConfidenceThresholds();
    
    if (decision.confidence < thresholds.minConfidence) {
      return false;
    }

    if (decision.riskReward < thresholds.minRiskReward) {
      return false;
    }

    const wallet = this.getWalletBalance();
    const minTradeAmount = wallet * 0.01;
    if (wallet < minTradeAmount) {
      return false;
    }

    if (this.tradesCountToday >= this.config.maxTradesPerDay) {
      return false;
    }

    if (this.tradesCountThisHour >= this.config.maxTradesPerHour) {
      return false;
    }

    if (this.lastAnalysisTime) {
      const timeSinceLastTrade = Date.now() - this.lastAnalysisTime.getTime();
      const minTime = this.config.minTimeBetweenTrades * 60 * 1000;
      if (timeSinceLastTrade < minTime) {
        return false;
      }
    }

    return true;
  }

  private calculatePositionSize(decision: AITradingDecision): number {
    const balance = this.getWalletBalance();
    const maxPositionValue = balance * (this.config.maxPositionSize / 100);
    
    const riskAmount = balance * (this.config.accountRiskPercent / 100);
    const stopDistance = Math.abs(decision.entryPrice - decision.stopLoss);
    const riskBasedQuantity = stopDistance > 0 ? riskAmount / stopDistance : 0;

    const maxQuantity = maxPositionValue / decision.entryPrice;
    
    const confidenceMultiplier = this.getConfidenceMultiplier(decision.confidence);
    let quantity = Math.min(riskBasedQuantity, maxQuantity) * confidenceMultiplier;

    quantity = Math.floor(quantity * 100000) / 100000;

    return quantity;
  }

  private getConfidenceMultiplier(confidence: number): number {
    if (confidence >= 70) return 1.0;
    if (confidence >= 50) return 0.7;
    return 0.5;
  }

  private shouldAnalyze(candles: Candle[]): boolean {
    if (candles.length < 20) return false;

    const priceChangeThreshold = this.getPriceChangeThreshold();
    const recentCandles = candles.slice(-10);
    const firstCandle = recentCandles[0];
    const lastCandle = recentCandles[recentCandles.length - 1];
    
    if (!firstCandle || !lastCandle) return false;
    
    const priceChange = Math.abs(
      (lastCandle.close - firstCandle.close) / firstCandle.close
    );

    return priceChange >= priceChangeThreshold / 100;
  }

  private getPriceChangeThreshold(): number {
    switch (this.config.riskProfile) {
      case 'conservative':
        return 2.0;
      case 'moderate':
        return 1.0;
      case 'aggressive':
        return 0.5;
      default:
        return 1.0;
    }
  }

  private getConfidenceThresholds(): { minConfidence: number; minRiskReward: number } {
    if (this.config.customConfidenceThreshold && this.config.customRiskReward) {
      return {
        minConfidence: this.config.customConfidenceThreshold,
        minRiskReward: this.config.customRiskReward,
      };
    }

    switch (this.config.riskProfile) {
      case 'conservative':
        return { minConfidence: 50, minRiskReward: 2.0 };
      case 'moderate':
        return { minConfidence: 40, minRiskReward: 1.5 };
      case 'aggressive':
        return { minConfidence: 30, minRiskReward: 1.0 };
      default:
        return { minConfidence: 40, minRiskReward: 1.5 };
    }
  }

  private getIntervalMs(): number {
    const intervalMap: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
    };

    return intervalMap[this.config.analysisInterval] || 5 * 60 * 1000;
  }

  private checkEmergencyStop(): boolean {
    if (this.consecutiveLosses >= this.config.emergencyStopLosses) {
      this.onError?.(new Error(`Emergency stop: ${this.consecutiveLosses} consecutive losses`));
      return true;
    }

    const maxDailyLoss = this.getWalletBalance() * (this.config.maxDailyLoss / 100);
    if (this.dailyLoss >= maxDailyLoss) {
      this.onError?.(new Error(`Emergency stop: daily loss limit reached (${this.dailyLoss})`));
      return true;
    }

    return false;
  }

  private updateTradeCounters(): void {
    this.tradesCountToday++;
    this.tradesCountThisHour++;

    setTimeout(() => {
      this.tradesCountThisHour--;
    }, 60 * 60 * 1000);
  }

  private resetDailyCounters(): void {
    this.tradesCountToday = 0;
    this.consecutiveLosses = 0;
    this.dailyLoss = 0;

    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      this.resetDailyCounters();
    }, msUntilMidnight);
  }

  recordTradeResult(pnl: number): void {
    if (pnl < 0) {
      this.consecutiveLosses++;
      this.dailyLoss += Math.abs(pnl);
    } else {
      this.consecutiveLosses = 0;
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getStatus(): {
    isRunning: boolean;
    tradesCountToday: number;
    tradesCountThisHour: number;
    consecutiveLosses: number;
    dailyLoss: number;
    lastAnalysisTime: Date | null;
  } {
    return {
      isRunning: this.isRunning,
      tradesCountToday: this.tradesCountToday,
      tradesCountThisHour: this.tradesCountThisHour,
      consecutiveLosses: this.consecutiveLosses,
      dailyLoss: this.dailyLoss,
      lastAnalysisTime: this.lastAnalysisTime,
    };
  }
}
