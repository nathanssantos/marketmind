export interface BacktestConfig {
    symbol: string;
    interval: string;
    startDate: string;
    endDate: string;
    initialCapital: number;
    minProfitPercent?: number;
    minRiskRewardRatio?: number;
    setupTypes?: string[];
    minConfidence?: number;
    useAlgorithmicLevels?: boolean;
    stopLossPercent?: number;
    takeProfitPercent?: number;
    commission?: number;
    slippagePercent?: number;
    useStochasticFilter?: boolean;
    useMomentumTimingFilter?: boolean;
    useAdxFilter?: boolean;
    useMtfFilter?: boolean;
    useBtcCorrelationFilter?: boolean;
    useMarketRegimeFilter?: boolean;
    useVolumeFilter?: boolean;
    useFundingFilter?: boolean;
    useConfluenceScoring?: boolean;
    confluenceMinScore?: number;
    exposureMultiplier?: number;
    marketType?: 'SPOT' | 'FUTURES';
    useBnbDiscount?: boolean;
    vipLevel?: number;
    leverage?: number;
    marginType?: 'ISOLATED' | 'CROSSED';
    simulateFundingRates?: boolean;
    simulateLiquidation?: boolean;
    strategyParams?: Record<string, number>;
    useTrailingStop?: boolean;
    trailingStopATRMultiplier?: number;
    trailingATRMultiplier?: number;
    breakEvenAfterR?: number;
    breakEvenBuffer?: number;
    usePartialExits?: boolean;
    partialExitLevels?: Array<{
        percentage: number;
        rMultiple: number;
    }>;
    lockProfitsAfterFirstExit?: boolean;
    useMarketContextFilter?: boolean;
    marketContextConfig?: {
        fearGreed?: {
            enabled?: boolean;
            thresholdLow?: number;
            thresholdHigh?: number;
            action?: 'block' | 'reduce_size' | 'warn_only';
            sizeReduction?: number;
        };
        fundingRate?: {
            enabled?: boolean;
            threshold?: number;
            action?: 'block' | 'penalize' | 'warn_only';
            penalty?: number;
        };
    };
    useCooldown?: boolean;
    cooldownMinutes?: number;
    onlyLong?: boolean;
    trendFilterPeriod?: number;
    useTrendFilter?: boolean;
    tpCalculationMode?: 'default' | 'fibonacci';
    fibonacciTpLevel?: number;
    fibonacciTargetLevel?: 'auto' | '1' | '1.272' | '1.382' | '1.5' | '1.618' | '2' | '2.272' | '2.618';
    fibonacciTargetLevelLong?: 'auto' | '1' | '1.272' | '1.382' | '1.5' | '1.618' | '2' | '2.272' | '2.618';
    fibonacciTargetLevelShort?: 'auto' | '1' | '1.272' | '1.382' | '1.5' | '1.618' | '2' | '2.272' | '2.618';
    maxFibonacciEntryProgressPercent?: number;
}
export interface BacktestTrade {
    id: string;
    setupId?: string;
    setupType?: string;
    setupConfidence?: number;
    entryTime: string;
    entryPrice: number;
    exitTime?: string;
    exitPrice?: number;
    side: 'LONG' | 'SHORT';
    quantity: number;
    stopLoss?: number;
    takeProfit?: number;
    pnl?: number;
    pnlPercent?: number;
    commission: number;
    netPnl?: number;
    exitReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL' | 'END_OF_PERIOD' | 'LIQUIDATION' | 'EXIT_CONDITION' | 'MAX_BARS';
    status: 'OPEN' | 'CLOSED';
    marketType?: 'SPOT' | 'FUTURES';
    leverage?: number;
    marginType?: 'ISOLATED' | 'CROSSED';
    liquidationPrice?: number;
    fundingPayments?: number;
    liquidationFee?: number;
    leveragedPnlPercent?: number;
}
export interface BacktestMetrics {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalPnl: number;
    totalPnlPercent: number;
    avgPnl: number;
    avgPnlPercent: number;
    grossWinRate: number;
    grossProfitFactor: number;
    totalGrossPnl: number;
    avgWin: number;
    avgLoss: number;
    largestWin: number;
    largestLoss: number;
    profitFactor: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    sharpeRatio?: number;
    sortinoRatio?: number;
    totalCommission: number;
    avgTradeDuration: number;
    avgWinDuration: number;
    avgLossDuration: number;
}
export interface BacktestEquityPoint {
    time: string;
    equity: number;
    drawdown: number;
    drawdownPercent: number;
}
export interface BacktestResult {
    id: string;
    config: BacktestConfig;
    trades: BacktestTrade[];
    metrics: BacktestMetrics;
    equityCurve: BacktestEquityPoint[];
    startTime: string;
    endTime: string;
    duration: number;
    status: 'RUNNING' | 'COMPLETED' | 'FAILED';
    error?: string;
    setupDetections?: import('./tradingSetup').TradingSetup[];
    klines?: import('./kline').Kline[];
}
export interface BacktestSummary {
    id: string;
    symbol: string;
    interval: string;
    startDate: string;
    endDate: string;
    initialCapital: number;
    finalEquity: number;
    totalPnl: number;
    totalPnlPercent: number;
    winRate: number;
    totalTrades: number;
    maxDrawdown: number;
    sharpeRatio?: number;
    createdAt: string;
    status: 'RUNNING' | 'COMPLETED' | 'FAILED';
}
export interface PyramidingConfig {
    profitThreshold: number;
    minDistance: number;
    maxEntries: number;
    scaleFactor: number;
    mlConfidenceBoost: number;
}
export type VolatilityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | 'EXTREME';
export interface VolatilityProfile {
    level: VolatilityLevel;
    atrPercent: number;
    atrMultiplier: number;
    breakevenThreshold: number;
    feesThreshold: number;
    minTrailingDistance: number;
}
export interface TrailingStopOptimizationConfig {
    breakevenProfitThreshold: number;
    breakevenWithFeesThreshold?: number;
    minTrailingDistancePercent: number;
    swingLookback: number;
    useATRMultiplier: boolean;
    atrMultiplier: number;
    feePercent?: number;
    trailingDistancePercent?: number;
    useVolatilityBasedThresholds?: boolean;
    marketType?: 'SPOT' | 'FUTURES';
    useBnbDiscount?: boolean;
    useFibonacciThresholds?: boolean;
}
export interface TimeframeThreshold {
    minProbability: number;
    minConfidence: number;
}
export interface FullSystemOptimizationConfig {
    symbol: string;
    interval: string;
    startDate: string;
    endDate: string;
    initialCapital: number;
    mlThresholds: number[];
    pyramidingConfigs: Partial<PyramidingConfig>[];
    trailingStopConfigs: Partial<TrailingStopOptimizationConfig>[];
    walkForward: {
        trainingMonths: number;
        testingMonths: number;
        stepMonths: number;
        minWindows: number;
    };
    minTrades: number;
    maxDegradation: number;
    topResultsForValidation: number;
}
export interface OptimizationResult {
    id: string;
    config: FullSystemOptimizationConfig;
    totalCombinations: number;
    completedCombinations: number;
    results: OptimizationResultEntry[];
    bestResult?: OptimizationResultEntry;
    walkForwardResults?: WalkForwardResult[];
    calibratedThresholds?: Record<string, TimeframeThreshold>;
    startTime: string;
    endTime?: string;
    duration?: number;
    status: 'RUNNING' | 'COMPLETED' | 'FAILED';
    error?: string;
}
export interface OptimizationResultEntry {
    id: string;
    params: {
        mlThreshold: number;
        pyramiding: Partial<PyramidingConfig>;
        trailingStop: Partial<TrailingStopOptimizationConfig>;
    };
    metrics: BacktestMetrics;
    walkForwardValidated?: boolean;
    degradationPercent?: number;
    rank?: number;
}
export interface WalkForwardResult {
    windowIndex: number;
    trainingStart: string;
    trainingEnd: string;
    testingStart: string;
    testingEnd: string;
    inSampleMetrics: BacktestMetrics;
    outOfSampleMetrics: BacktestMetrics;
    degradationPercent: number;
    isRobust: boolean;
}
export interface WatcherConfig {
    symbol: string;
    interval: string;
    setupTypes?: string[];
    marketType?: 'SPOT' | 'FUTURES';
    profileId?: string;
}
export interface MultiWatcherBacktestConfig extends Omit<BacktestConfig, 'symbol' | 'interval'> {
    watchers: WatcherConfig[];
    exposureMultiplier?: number;
    useSharedExposure?: boolean;
    trailingStopSimulationInterval?: import('./kline').Interval;
}
export interface WatcherStats {
    symbol: string;
    interval: string;
    totalSetups: number;
    tradesExecuted: number;
    tradesSkipped: number;
    skippedReasons: Record<string, number>;
    pnl: number;
    winRate: number;
    winningTrades: number;
    losingTrades: number;
}
export interface TimelineEvent {
    timestamp: number;
    type: 'setup' | 'entry' | 'exit' | 'conflict';
    watcherSymbol: string;
    watcherInterval: string;
    details: Record<string, unknown>;
}
export interface ConflictStats {
    totalConflicts: number;
    resolvedBy: Record<string, number>;
    conflictsPerWatcher: Record<string, number>;
}
export interface MultiWatcherBacktestResult extends Omit<BacktestResult, 'config'> {
    config: MultiWatcherBacktestConfig;
    watcherStats: WatcherStats[];
    timeline: TimelineEvent[];
    conflictStats: ConflictStats;
}
//# sourceMappingURL=backtesting.d.ts.map