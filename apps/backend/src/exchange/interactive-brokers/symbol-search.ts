import { SecType } from '@stoqey/ib';
import type { ContractDescription } from '@stoqey/ib';
import { IBConnectionManager, getDefaultConnectionManager } from './connection-manager';
import type { IBSymbolSearchResult } from './types';

export interface SymbolSearchOptions {
  secType?: SecType;
  maxResults?: number;
  includeDerivatives?: boolean;
}

const DEFAULT_OPTIONS: Required<SymbolSearchOptions> = {
  secType: SecType.STK,
  maxResults: 20,
  includeDerivatives: false,
};

export class IBSymbolSearch {
  private connectionManager: IBConnectionManager;
  private cache: Map<string, { results: IBSymbolSearchResult[]; timestamp: number }> = new Map();
  private readonly cacheTtlMs = 300_000;

  constructor(connectionManager?: IBConnectionManager) {
    this.connectionManager = connectionManager ?? getDefaultConnectionManager();
  }

  async searchSymbols(
    pattern: string,
    options: SymbolSearchOptions = {}
  ): Promise<IBSymbolSearchResult[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const normalizedPattern = pattern.toUpperCase().trim();

    if (normalizedPattern.length < 1) {
      return [];
    }

    const cacheKey = `${normalizedPattern}:${opts.secType}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.results.slice(0, opts.maxResults);
    }

    if (!this.connectionManager.isConnected) {
      await this.connectionManager.connect();
    }

    try {
      const descriptions = await this.connectionManager.client.getMatchingSymbols(normalizedPattern);
      const results = this.mapToSearchResults(descriptions, opts);

      this.cache.set(cacheKey, { results, timestamp: Date.now() });

      return results.slice(0, opts.maxResults);
    } catch (error) {
      console.error(`[IBSymbolSearch] Error searching for "${pattern}":`, error);
      return [];
    }
  }

  private mapToSearchResults(
    descriptions: ContractDescription[],
    options: Required<SymbolSearchOptions>
  ): IBSymbolSearchResult[] {
    const results: IBSymbolSearchResult[] = [];

    for (const desc of descriptions) {
      const contract = desc.contract;
      if (!contract) continue;

      if (options.secType && contract.secType !== options.secType) {
        continue;
      }

      const result: IBSymbolSearchResult = {
        conId: contract.conId ?? 0,
        symbol: contract.symbol ?? '',
        secType: String(contract.secType ?? SecType.STK),
        primaryExchange: contract.primaryExch ?? contract.exchange ?? '',
        currency: contract.currency ?? 'USD',
        description: contract.description,
      };

      if (options.includeDerivatives && desc.derivativeSecTypes) {
        result.derivativeSecTypes = desc.derivativeSecTypes.map(String);
      }

      results.push(result);
    }

    return results.sort((a, b) => {
      if (a.symbol.length !== b.symbol.length) {
        return a.symbol.length - b.symbol.length;
      }
      return a.symbol.localeCompare(b.symbol);
    });
  }

  async getContractDetails(symbol: string): Promise<IBSymbolSearchResult | null> {
    const results = await this.searchSymbols(symbol, { maxResults: 1 });
    return results[0] ?? null;
  }

  async searchStocks(pattern: string, maxResults = 20): Promise<IBSymbolSearchResult[]> {
    return this.searchSymbols(pattern, {
      secType: SecType.STK,
      maxResults,
      includeDerivatives: false,
    });
  }

  async searchETFs(pattern: string, maxResults = 20): Promise<IBSymbolSearchResult[]> {
    const results = await this.searchSymbols(pattern, {
      secType: SecType.STK,
      maxResults: maxResults * 2,
      includeDerivatives: false,
    });

    return results
      .filter((r) => this.isLikelyETF(r))
      .slice(0, maxResults);
  }

  private isLikelyETF(result: IBSymbolSearchResult): boolean {
    const etfExchanges = ['ARCA', 'BATS', 'NYSE'];
    const symbol = result.symbol.toUpperCase();

    if (symbol.length <= 4 && etfExchanges.includes(result.primaryExchange)) {
      return true;
    }

    const etfKeywords = ['ETF', 'FUND', 'INDEX', 'TRUST', 'ISHARES', 'VANGUARD', 'SPDR'];
    const description = (result.description ?? '').toUpperCase();
    return etfKeywords.some((keyword) => description.includes(keyword));
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearSymbolCache(pattern: string): void {
    const normalizedPattern = pattern.toUpperCase().trim();
    for (const key of this.cache.keys()) {
      if (key.startsWith(normalizedPattern)) {
        this.cache.delete(key);
      }
    }
  }

  getCacheStats(): { size: number; oldestEntry: number | null } {
    let oldestTimestamp: number | null = null;

    for (const { timestamp } of this.cache.values()) {
      if (oldestTimestamp === null || timestamp < oldestTimestamp) {
        oldestTimestamp = timestamp;
      }
    }

    return {
      size: this.cache.size,
      oldestEntry: oldestTimestamp,
    };
  }
}

export const symbolSearch = new IBSymbolSearch();
