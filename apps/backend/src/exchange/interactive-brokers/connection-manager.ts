import { IBApiNext, ConnectionState } from '@stoqey/ib';
import { Subscription, BehaviorSubject, firstValueFrom, filter, timeout, take } from 'rxjs';
import {
  IB_DEFAULT_HOST,
  IB_DEFAULT_CLIENT_ID,
  IB_PORTS,
  IB_CONNECTION_TIMEOUT_MS,
  IB_RECONNECT_DELAY_MS,
} from './constants';
import type { IBConnectionConfig, IBConnectionState } from './types';

export class IBConnectionManager {
  private api: IBApiNext | null = null;
  private connectionSubscription: Subscription | null = null;
  private errorSubscription: Subscription | null = null;
  private config: IBConnectionConfig;
  private readonly stateSubject = new BehaviorSubject<IBConnectionState>({
    connected: false,
    connecting: false,
    reconnecting: false,
  });

  constructor(config: Partial<IBConnectionConfig> = {}) {
    this.config = {
      host: config.host ?? IB_DEFAULT_HOST,
      port: config.port ?? IB_PORTS.GATEWAY_PAPER,
      clientId: config.clientId ?? IB_DEFAULT_CLIENT_ID,
      connectionTimeout: config.connectionTimeout ?? IB_CONNECTION_TIMEOUT_MS,
    };
  }

  get state(): IBConnectionState {
    return this.stateSubject.getValue();
  }

  get stateObservable() {
    return this.stateSubject.asObservable();
  }

  get isConnected(): boolean {
    return this.state.connected;
  }

  get client(): IBApiNext {
    if (!this.api) {
      throw new Error('IB API not initialized. Call connect() first.');
    }
    return this.api;
  }

  async connect(): Promise<void> {
    if (this.state.connected) {
      return;
    }

    if (this.state.connecting) {
      await this.waitForConnection();
      return;
    }

    this.updateState({ connecting: true, reconnecting: false });

    try {
      this.api = new IBApiNext({
        host: this.config.host,
        port: this.config.port,
        reconnectInterval: IB_RECONNECT_DELAY_MS,
        connectionWatchdogInterval: 30,
        maxReqPerSec: 45,
      });

      this.setupEventHandlers();
      this.api.connect(this.config.clientId);

      await this.waitForConnection();
    } catch (error) {
      this.updateState({
        connecting: false,
        connected: false,
        lastError: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.api) {
      return;
    }

    this.connectionSubscription?.unsubscribe();
    this.errorSubscription?.unsubscribe();
    this.connectionSubscription = null;
    this.errorSubscription = null;

    this.api.disconnect();
    this.api = null;

    this.updateState({
      connected: false,
      connecting: false,
      reconnecting: false,
      connectionTime: undefined,
      serverVersion: undefined,
    });
  }

  async reconnect(): Promise<void> {
    this.updateState({ reconnecting: true });
    await this.disconnect();
    await this.connect();
  }

  private setupEventHandlers(): void {
    if (!this.api) return;

    this.connectionSubscription = this.api.connectionState.subscribe({
      next: (state: ConnectionState) => {
        switch (state) {
          case ConnectionState.Connected:
            this.updateState({
              connected: true,
              connecting: false,
              reconnecting: false,
              connectionTime: new Date(),
              lastError: undefined,
            });
            break;
          case ConnectionState.Connecting:
            this.updateState({
              connected: false,
              connecting: true,
            });
            break;
          case ConnectionState.Disconnected:
            this.updateState({
              connected: false,
              connecting: false,
            });
            break;
        }
      },
      error: (err) => {
        this.updateState({
          connected: false,
          connecting: false,
          lastError: err instanceof Error ? err : new Error(String(err)),
        });
      },
    });

    this.errorSubscription = this.api.error.subscribe({
      next: (error) => {
        const isConnectionError = error.code >= 1100 && error.code <= 1102;
        if (isConnectionError) {
          this.updateState({
            connected: false,
            lastError: new Error(`IB Error ${error.code}: ${error.message}`),
          });
        }
      },
    });
  }

  private async waitForConnection(): Promise<void> {
    if (!this.api) {
      throw new Error('IB API not initialized');
    }

    await firstValueFrom(
      this.api.connectionState.pipe(
        filter((state) => state === ConnectionState.Connected),
        timeout(this.config.connectionTimeout ?? IB_CONNECTION_TIMEOUT_MS),
        take(1)
      )
    );
  }

  private updateState(partial: Partial<IBConnectionState>): void {
    this.stateSubject.next({
      ...this.stateSubject.getValue(),
      ...partial,
    });
  }

  async getManagedAccounts(): Promise<string[]> {
    this.ensureConnected();
    return this.client.getManagedAccounts();
  }

  async getCurrentTime(): Promise<number> {
    this.ensureConnected();
    return this.client.getCurrentTime();
  }

  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new Error('Not connected to IB Gateway');
    }
  }
}

export const getDefaultConnectionManager = (): IBConnectionManager => {
  return new IBConnectionManager();
};

export const createConnectionManager = (
  config: Partial<IBConnectionConfig>
): IBConnectionManager => {
  return new IBConnectionManager(config);
};
