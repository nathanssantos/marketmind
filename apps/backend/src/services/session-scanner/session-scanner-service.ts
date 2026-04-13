import { createLogger } from '@marketmind/logger';

const logger = createLogger('session-scanner');
import type { ScreenerConfig, ScreenerResponse, TimeInterval } from '@marketmind/types';
import { getActiveSessions, type SessionDefinition, type SessionStatus } from './session-registry';
import { getScreenerService } from '../screener/screener-service';
import { getPresetById } from '../screener/presets';
import type { WebSocketService } from '../websocket';
import { SESSION_SCANNER } from '../../constants';

interface CachedResult {
  sessionId: string;
  presetId: string;
  results: ScreenerResponse;
  cachedAt: number;
}

interface SessionScanConfig {
  enabled: boolean;
  markets: string[];
  interval: TimeInterval;
  userId?: string;
}

export class SessionScannerService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private cache = new Map<string, CachedResult>();
  private config: SessionScanConfig = { enabled: false, markets: [], interval: '30m' };
  private wsService: WebSocketService | null = null;

  setWebSocketService(ws: WebSocketService): void {
    this.wsService = ws;
  }

  updateConfig(config: Partial<SessionScanConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.enabled && !this.intervalId) {
      this.start();
    } else if (!this.config.enabled && this.intervalId) {
      this.stop();
    }
  }

  start(): void {
    if (this.intervalId) return;
    logger.info('[SessionScanner] Starting session scanner');
    this.intervalId = setInterval(() => void this.scan(), SESSION_SCANNER.SCAN_INTERVAL_MS);
    void this.scan();
  }

  stop(): void {
    if (!this.intervalId) return;
    logger.info('[SessionScanner] Stopping session scanner');
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  async scan(): Promise<void> {
    if (!this.config.enabled) return;

    const activeSessions = getActiveSessions();
    const enabledSessions = activeSessions.filter(
      (s) => this.config.markets.length === 0 || this.config.markets.includes(s.id)
    );

    for (const session of enabledSessions) {
      await this.scanSession(session);
    }
  }

  private async scanSession(session: SessionDefinition & { status: SessionStatus }): Promise<void> {
    for (const presetId of session.defaultPresets) {
      const cacheKey = `${session.id}:${presetId}`;
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.cachedAt < SESSION_SCANNER.RESULT_CACHE_TTL_MS) continue;

      const preset = getPresetById(presetId);
      if (!preset) continue;

      try {
        const config: ScreenerConfig = {
          ...preset.config,
          assetClass: session.id === 'CRYPTO' ? 'CRYPTO' : 'STOCKS',
          marketType: session.id === 'CRYPTO' ? 'FUTURES' : 'SPOT',
          interval: this.config.interval,
          limit: 20,
        };

        const results = await getScreenerService().runScreener(config);

        this.cache.set(cacheKey, {
          sessionId: session.id,
          presetId,
          results,
          cachedAt: Date.now(),
        });

        if (results.results.length > 0 && this.wsService && this.config.userId) {
          this.wsService.emitSessionScanResult(this.config.userId, session.id, presetId, results);
        }
      } catch (err) {
        logger.error(`[SessionScanner] Failed to scan ${session.id}/${presetId}: ${err}`);
      }
    }
  }

  getLatestResults(sessionId: string): CachedResult[] {
    const results: CachedResult[] = [];
    for (const [key, value] of this.cache) {
      if (key.startsWith(`${sessionId}:`)) {
        results.push(value);
      }
    }
    return results;
  }

  getStatus(): { running: boolean; activeSessions: Array<{ id: string; name: string; status: SessionStatus }> } {
    const activeSessions = getActiveSessions().map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
    }));

    return {
      running: this.intervalId !== null,
      activeSessions,
    };
  }

  destroy(): void {
    this.stop();
    this.cache.clear();
  }
}

export const sessionScannerService = new SessionScannerService();
