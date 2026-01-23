export interface ChaosConfig {
  failureRate: number;
  latencyMin: number;
  latencyMax: number;
  enabled: boolean;
}

export class ChaosMonkey {
  private config: ChaosConfig;

  constructor(config: Partial<ChaosConfig> = {}) {
    this.config = {
      failureRate: config.failureRate ?? 0.1,
      latencyMin: config.latencyMin ?? 100,
      latencyMax: config.latencyMax ?? 500,
      enabled: config.enabled ?? true,
    };
  }

  async maybeInjectLatency(): Promise<void> {
    if (!this.config.enabled) return;

    const latency =
      Math.random() * (this.config.latencyMax - this.config.latencyMin) +
      this.config.latencyMin;

    await new Promise((resolve) => setTimeout(resolve, latency));
  }

  shouldFail(): boolean {
    if (!this.config.enabled) return false;
    return Math.random() < this.config.failureRate;
  }

  maybeThrowError(message = 'Chaos-induced failure'): void {
    if (this.shouldFail()) {
      throw new Error(message);
    }
  }

  disable(): void {
    this.config.enabled = false;
  }

  enable(): void {
    this.config.enabled = true;
  }

  setFailureRate(rate: number): void {
    this.config.failureRate = Math.max(0, Math.min(1, rate));
  }
}

export class NetworkChaos {
  private dropRate: number;
  private corruptRate: number;
  private enabled: boolean;

  constructor(dropRate = 0.05, corruptRate = 0.02) {
    this.dropRate = dropRate;
    this.corruptRate = corruptRate;
    this.enabled = true;
  }

  shouldDropPacket(): boolean {
    if (!this.enabled) return false;
    return Math.random() < this.dropRate;
  }

  shouldCorrupt(): boolean {
    if (!this.enabled) return false;
    return Math.random() < this.corruptRate;
  }

  corruptData<T>(data: T): T {
    if (!this.shouldCorrupt()) return data;

    if (typeof data === 'string') {
      const index = Math.floor(Math.random() * data.length);
      return (data.slice(0, index) +
        String.fromCharCode(Math.floor(Math.random() * 256)) +
        data.slice(index + 1)) as T;
    }

    if (typeof data === 'number') {
      return (data + (Math.random() - 0.5) * data * 0.1) as T;
    }

    return data;
  }

  disable(): void {
    this.enabled = false;
  }

  enable(): void {
    this.enabled = true;
  }
}

export class ResourceChaos {
  private enabled: boolean;

  constructor() {
    this.enabled = false;
  }

  async simulateMemoryPressure(megabytes: number, durationMs: number): Promise<void> {
    if (!this.enabled) return;

    const arrays: number[][] = [];
    const bytesPerMB = 1024 * 1024;
    const elementsNeeded = Math.floor((megabytes * bytesPerMB) / 8);

    for (let i = 0; i < elementsNeeded; i += 1000000) {
      arrays.push(new Array(Math.min(1000000, elementsNeeded - i)).fill(0));
    }

    await new Promise((resolve) => setTimeout(resolve, durationMs));

    arrays.length = 0;
  }

  async simulateCpuSpike(durationMs: number): Promise<void> {
    if (!this.enabled) return;

    const start = Date.now();
    let counter = 0;

    while (Date.now() - start < durationMs) {
      counter++;
      Math.sqrt(counter);
    }
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }
}

export const createChaosMiddleware = (chaos: ChaosMonkey) => {
  return async (
    _req: unknown,
    _res: unknown,
    next: () => Promise<void>
  ): Promise<void> => {
    await chaos.maybeInjectLatency();
    chaos.maybeThrowError('Simulated service failure');
    await next();
  };
};
