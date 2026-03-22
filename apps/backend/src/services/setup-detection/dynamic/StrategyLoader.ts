import { serializeError } from '../../../utils/errors';

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
import { logger } from '../../logger';
import { validateStrategyDefinition } from './strategyValidation';

export interface StrategyLoadOptions {
  includeStatuses?: StrategyStatus[];
  excludeStatuses?: StrategyStatus[];
  includeUnprofitable?: boolean;
}

const DEFAULT_EXCLUDED_STATUSES: StrategyStatus[] = ['unprofitable', 'deprecated'];

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

export class StrategyLoader {
  private strategies: Map<string, StrategyFile> = new Map();
  private strategyPaths: string[];
  private watchHandlers: fs.FSWatcher[] = [];
  private cachedDefinitions: StrategyDefinition[] | null = null;
  private dirMtimeCache = new Map<string, number>();

  constructor(strategyPaths: string[]) {
    this.strategyPaths = strategyPaths;
  }

  async loadAll(options: StrategyLoadOptions = {}): Promise<StrategyDefinition[]> {
    this.cachedDefinitions = null;
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
          definitions.push(definition);
        } catch (error) {
          logger.error({ filePath, error: serializeError(error) }, 'Failed to load strategy');
        }
      }
    }

    this.cachedDefinitions = definitions;
    return definitions.filter((d) => this.shouldIncludeStrategy(d, options));
  }

  async loadAllCached(options: StrategyLoadOptions = {}): Promise<StrategyDefinition[]> {
    if (this.cachedDefinitions && !this.hasDirectoryChanged()) {
      return this.cachedDefinitions.filter((d) => this.shouldIncludeStrategy(d, options));
    }
    return this.loadAll(options);
  }

  private hasDirectoryChanged(): boolean {
    for (const basePath of this.strategyPaths) {
      try {
        const stat = fs.statSync(basePath);
        const cached = this.dirMtimeCache.get(basePath);
        if (!cached || stat.mtimeMs !== cached) {
          this.dirMtimeCache.set(basePath, stat.mtimeMs);
          return true;
        }
      } catch {
        return true;
      }
    }
    return false;
  }

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

  async loadStrategy(filePath: string): Promise<StrategyDefinition> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const hash = this.calculateHash(content);

    let definition: unknown;
    try {
      definition = JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse JSON in ${filePath}: ${error}`);
    }

    const validation = this.validateStrategy(definition);
    if (!validation.valid) {
      throw new StrategyValidationException(
        (definition as { id?: string }).id ?? 'unknown',
        validation.errors
      );
    }

    const strategyDef = definition as StrategyDefinition;

    this.strategies.set(strategyDef.id, {
      path: filePath,
      definition: strategyDef,
      loadedAt: new Date(),
      hash,
    });

    return strategyDef;
  }

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

  validateStrategy(definition: unknown): StrategyValidationResult {
    return validateStrategyDefinition(definition);
  }

  getLoadedStrategies(): StrategyFile[] {
    return Array.from(this.strategies.values());
  }

  getStrategy(id: string): StrategyDefinition | undefined {
    return this.strategies.get(id)?.definition;
  }

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
            logger.error({ error: serializeError(error) }, 'Error reloading strategies');
          }
        }
      );

      this.watchHandlers.push(watcher);
    }
  }

  stopWatching(): void {
    for (const watcher of this.watchHandlers) {
      watcher.close();
    }
    this.watchHandlers = [];
  }

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

  private calculateHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }
}
