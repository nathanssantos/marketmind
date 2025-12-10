/**
 * Strategy Loader
 *
 * Loads strategy definitions from JSON files in the strategies directory.
 * Supports validation, hot-reloading, and strategy metadata.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type {
  StrategyDefinition,
  StrategyFile,
  StrategyValidationResult,
  StrategyValidationError,
  StrategyStatus,
} from '@marketmind/types';

/**
 * Options for loading strategies
 */
export interface StrategyLoadOptions {
  includeStatuses?: StrategyStatus[];
  excludeStatuses?: StrategyStatus[];
  includeUnprofitable?: boolean;
}

const DEFAULT_EXCLUDED_STATUSES: StrategyStatus[] = ['unprofitable', 'deprecated'];

/**
 * Error thrown when strategy validation fails
 */
export class StrategyValidationException extends Error {
  constructor(
    public strategyId: string,
    public errors: StrategyValidationError[]
  ) {
    super(
      `Invalid strategy ${strategyId}: ${errors.map((e) => e.message).join(', ')}`
    );
    this.name = 'StrategyValidationException';
  }
}

/**
 * Loads and validates strategy definitions from files
 */
export class StrategyLoader {
  private strategies: Map<string, StrategyFile> = new Map();
  private strategyPaths: string[];
  private watchHandlers: fs.FSWatcher[] = [];

  constructor(strategyPaths: string[]) {
    this.strategyPaths = strategyPaths;
  }

  /**
   * Load all strategies from configured paths
   * @param options - Options for filtering strategies by status
   */
  async loadAll(options: StrategyLoadOptions = {}): Promise<StrategyDefinition[]> {
    this.strategies.clear();
    const definitions: StrategyDefinition[] = [];

    for (const basePath of this.strategyPaths) {
      if (!fs.existsSync(basePath)) {
        continue;
      }

      const files = await this.findStrategyFiles(basePath);

      for (const filePath of files) {
        try {
          const definition = await this.loadStrategy(filePath);
          if (this.shouldIncludeStrategy(definition, options)) {
            definitions.push(definition);
          }
        } catch (error) {
          console.error(`Failed to load strategy from ${filePath}:`, error);
        }
      }
    }

    return definitions;
  }

  /**
   * Check if a strategy should be included based on options
   */
  private shouldIncludeStrategy(
    definition: StrategyDefinition,
    options: StrategyLoadOptions
  ): boolean {
    const status = definition.status ?? 'active';

    if (options.includeUnprofitable) return true;
    if (options.includeStatuses?.length) return options.includeStatuses.includes(status);
    const excludeStatuses = options.excludeStatuses ?? DEFAULT_EXCLUDED_STATUSES;
    return !excludeStatuses.includes(status);
  }

  /**
   * Load a single strategy from a file
   */
  async loadStrategy(filePath: string): Promise<StrategyDefinition> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const hash = this.calculateHash(content);

    let definition: unknown;
    try {
      definition = JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse JSON in ${filePath}: ${error}`);
    }

    // Validate the strategy
    const validation = this.validateStrategy(definition);
    if (!validation.valid) {
      throw new StrategyValidationException(
        (definition as { id?: string }).id ?? 'unknown',
        validation.errors
      );
    }

    const strategyDef = definition as StrategyDefinition;

    // Store in cache
    this.strategies.set(strategyDef.id, {
      path: filePath,
      definition: strategyDef,
      loadedAt: new Date(),
      hash,
    });

    return strategyDef;
  }

  /**
   * Load strategy from JSON string (for copy/paste support)
   */
  loadFromString(jsonContent: string): StrategyDefinition {
    let definition: unknown;
    try {
      definition = JSON.parse(jsonContent);
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${error}`);
    }

    const validation = this.validateStrategy(definition);
    if (!validation.valid) {
      throw new StrategyValidationException(
        (definition as { id?: string }).id ?? 'unknown',
        validation.errors
      );
    }

    return definition as StrategyDefinition;
  }

  /**
   * Validate a strategy definition
   */
  validateStrategy(definition: unknown): StrategyValidationResult {
    const errors: StrategyValidationError[] = [];
    const warnings: StrategyValidationError[] = [];

    if (!definition || typeof definition !== 'object') {
      errors.push({
        path: '',
        message: 'Strategy must be an object',
        severity: 'error',
      });
      return { valid: false, errors, warnings };
    }

    const def = definition as Record<string, unknown>;

    // Required fields
    this.validateRequired(def, 'id', 'string', errors);
    this.validateRequired(def, 'name', 'string', errors);
    this.validateRequired(def, 'version', 'string', errors);
    this.validateRequired(def, 'parameters', 'object', errors);
    this.validateRequired(def, 'indicators', 'object', errors);
    this.validateRequired(def, 'entry', 'object', errors);
    this.validateRequired(def, 'exit', 'object', errors);

    // ID format
    if (typeof def['id'] === 'string' && !/^[a-z0-9-]+$/.test(def['id'])) {
      errors.push({
        path: 'id',
        message: 'ID must be kebab-case (lowercase letters, numbers, hyphens)',
        severity: 'error',
      });
    }

    // Version format
    if (typeof def['version'] === 'string' && !/^\d+\.\d+\.\d+$/.test(def['version'])) {
      warnings.push({
        path: 'version',
        message: 'Version should follow semantic versioning (e.g., 1.0.0)',
        severity: 'warning',
      });
    }

    // Validate indicators
    if (def['indicators'] && typeof def['indicators'] === 'object') {
      this.validateIndicators(
        def['indicators'] as Record<string, unknown>,
        errors,
        warnings
      );
    }

    // Validate entry conditions
    if (def['entry'] && typeof def['entry'] === 'object') {
      this.validateEntry(def['entry'] as Record<string, unknown>, errors);
    }

    // Validate exit config
    if (def['exit'] && typeof def['exit'] === 'object') {
      this.validateExit(def['exit'] as Record<string, unknown>, errors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get all loaded strategies
   */
  getLoadedStrategies(): StrategyFile[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Get a specific strategy by ID
   */
  getStrategy(id: string): StrategyDefinition | undefined {
    return this.strategies.get(id)?.definition;
  }

  /**
   * Check if a strategy has changed since last load
   */
  async hasChanged(strategyId: string): Promise<boolean> {
    const strategyFile = this.strategies.get(strategyId);
    if (!strategyFile) {
      return true;
    }

    try {
      const content = await fs.promises.readFile(strategyFile.path, 'utf-8');
      const newHash = this.calculateHash(content);
      return newHash !== strategyFile.hash;
    } catch {
      return true;
    }
  }

  /**
   * Watch for strategy file changes
   */
  watchForChanges(
    callback: (strategies: StrategyDefinition[]) => void
  ): void {
    for (const basePath of this.strategyPaths) {
      if (!fs.existsSync(basePath)) {
        continue;
      }

      const watcher = fs.watch(
        basePath,
        { recursive: true },
        async (_eventType, filename) => {
          if (!filename?.endsWith('.json')) {
            return;
          }

          try {
            const strategies = await this.loadAll();
            callback(strategies);
          } catch (error) {
            console.error('Error reloading strategies:', error);
          }
        }
      );

      this.watchHandlers.push(watcher);
    }
  }

  /**
   * Stop watching for changes
   */
  stopWatching(): void {
    for (const watcher of this.watchHandlers) {
      watcher.close();
    }
    this.watchHandlers = [];
  }

  /**
   * Find all strategy JSON files in a directory
   */
  private async findStrategyFiles(basePath: string): Promise<string[]> {
    const files: string[] = [];

    const entries = await fs.promises.readdir(basePath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(basePath, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await this.findStrategyFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Calculate hash of file content
   */
  private calculateHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Validate a required field
   */
  private validateRequired(
    obj: Record<string, unknown>,
    field: string,
    expectedType: string,
    errors: StrategyValidationError[]
  ): void {
    if (obj[field] === undefined) {
      errors.push({
        path: field,
        message: `Missing required field: ${field}`,
        severity: 'error',
      });
    } else if (typeof obj[field] !== expectedType) {
      errors.push({
        path: field,
        message: `${field} must be a ${expectedType}`,
        severity: 'error',
      });
    }
  }

  /**
   * Validate indicator definitions
   */
  private validateIndicators(
    indicators: Record<string, unknown>,
    errors: StrategyValidationError[],
    warnings: StrategyValidationError[]
  ): void {
    const validTypes = [
      'sma',
      'ema',
      'rsi',
      'macd',
      'bollingerBands',
      'atr',
      'stochastic',
      'vwap',
      'pivotPoints',
      'adx',
      'obv',
      'williamsR',
      'cci',
      'mfi',
      'donchian',
      'keltner',
      'supertrend',
      'ibs',
      'percentB',
      'cumulativeRsi',
      'nDayHighLow',
      'nr7',
      'roc',
      'dema',
      'tema',
      'wma',
      'hma',
      'cmo',
      'ao',
      'ppo',
      'tsi',
      'ultimateOscillator',
      'aroon',
      'dmi',
      'vortex',
      'parabolicSar',
      'massIndex',
      'cmf',
      'klinger',
      'elderRay',
      'deltaVolume',
      'swingPoints',
      'fvg',
      'candlePatterns',
      'gapDetection',
      'fibonacci',
      'floorPivots',
      'liquidityLevels',
      'fundingRate',
      'openInterest',
      'liquidations',
      'btcDominance',
      'relativeStrength',
    ];

    for (const [id, indicator] of Object.entries(indicators)) {
      if (!indicator || typeof indicator !== 'object') {
        errors.push({
          path: `indicators.${id}`,
          message: 'Indicator must be an object',
          severity: 'error',
        });
        continue;
      }

      const ind = indicator as Record<string, unknown>;

      if (!ind['type'] || typeof ind['type'] !== 'string') {
        errors.push({
          path: `indicators.${id}.type`,
          message: 'Indicator type is required',
          severity: 'error',
        });
      } else if (!validTypes.includes(ind['type'])) {
        errors.push({
          path: `indicators.${id}.type`,
          message: `Unknown indicator type: ${ind['type']}. Valid types: ${validTypes.join(', ')}`,
          severity: 'error',
        });
      }

      if (!ind['params'] || typeof ind['params'] !== 'object') {
        warnings.push({
          path: `indicators.${id}.params`,
          message: 'Indicator params should be an object',
          severity: 'warning',
        });
      }
    }
  }

  /**
   * Validate entry conditions
   */
  private validateEntry(
    entry: Record<string, unknown>,
    errors: StrategyValidationError[]
  ): void {
    if (!entry['long'] && !entry['short']) {
      errors.push({
        path: 'entry',
        message: 'At least one of entry.long or entry.short is required',
        severity: 'error',
      });
    }

    if (entry['long']) {
      this.validateConditionGroup(entry['long'], 'entry.long', errors);
    }

    if (entry['short']) {
      this.validateConditionGroup(entry['short'], 'entry.short', errors);
    }
  }

  /**
   * Validate a condition group
   */
  private validateConditionGroup(
    group: unknown,
    path: string,
    errors: StrategyValidationError[]
  ): void {
    if (!group || typeof group !== 'object') {
      errors.push({
        path,
        message: 'Condition group must be an object',
        severity: 'error',
      });
      return;
    }

    const g = group as Record<string, unknown>;

    if (!g['operator'] || !['AND', 'OR'].includes(g['operator'] as string)) {
      errors.push({
        path: `${path}.operator`,
        message: 'Condition group operator must be "AND" or "OR"',
        severity: 'error',
      });
    }

    if (!Array.isArray(g['conditions']) || g['conditions'].length === 0) {
      errors.push({
        path: `${path}.conditions`,
        message: 'Condition group must have at least one condition',
        severity: 'error',
      });
    }
  }

  /**
   * Validate exit configuration
   * Exit can use:
   * 1. Traditional SL/TP (stopLoss + takeProfit required)
   * 2. Indicator-based exit (conditions + optional stopLoss as safety)
   * 3. Both combined
   */
  private validateExit(
    exit: Record<string, unknown>,
    errors: StrategyValidationError[]
  ): void {
    const hasStopLoss = !!exit['stopLoss'];
    const hasTakeProfit = !!exit['takeProfit'];
    const hasConditions = !!exit['conditions'];

    if (!hasStopLoss && !hasConditions) {
      errors.push({
        path: 'exit',
        message: 'exit must have either stopLoss or conditions (or both)',
        severity: 'error',
      });
    }

    if (!hasTakeProfit && !hasConditions) {
      errors.push({
        path: 'exit',
        message: 'exit must have either takeProfit or conditions (or both)',
        severity: 'error',
      });
    }

    if (hasStopLoss) {
      this.validateExitLevel(exit['stopLoss'], 'exit.stopLoss', errors);
    }

    if (hasTakeProfit) {
      this.validateExitLevel(exit['takeProfit'], 'exit.takeProfit', errors);
    }

    if (hasConditions) {
      this.validateExitConditions(exit['conditions'], errors);
    }
  }

  /**
   * Validate exit conditions
   */
  private validateExitConditions(
    conditions: unknown,
    errors: StrategyValidationError[]
  ): void {
    if (!conditions || typeof conditions !== 'object') {
      errors.push({
        path: 'exit.conditions',
        message: 'exit.conditions must be an object',
        severity: 'error',
      });
      return;
    }

    const cond = conditions as Record<string, unknown>;

    if (!cond['long'] && !cond['short']) {
      errors.push({
        path: 'exit.conditions',
        message: 'exit.conditions must have at least long or short',
        severity: 'error',
      });
    }

    if (cond['long']) {
      this.validateConditionGroup(cond['long'], 'exit.conditions.long', errors);
    }

    if (cond['short']) {
      this.validateConditionGroup(cond['short'], 'exit.conditions.short', errors);
    }
  }

  /**
   * Validate an exit level
   */
  private validateExitLevel(
    level: unknown,
    path: string,
    errors: StrategyValidationError[]
  ): void {
    if (!level || typeof level !== 'object') {
      errors.push({
        path,
        message: 'Exit level must be an object',
        severity: 'error',
      });
      return;
    }

    const l = level as Record<string, unknown>;
    const validTypes = ['atr', 'percent', 'fixed', 'indicator', 'riskReward'];

    if (!l['type'] || !validTypes.includes(l['type'] as string)) {
      errors.push({
        path: `${path}.type`,
        message: `Exit level type must be one of: ${validTypes.join(', ')}`,
        severity: 'error',
      });
    }
  }
}
