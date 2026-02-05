import { describe, it, expect, beforeEach } from 'vitest';
import {
  IBConnectionManager,
  createConnectionManager,
  getDefaultConnectionManager,
} from '../../exchange/interactive-brokers/connection-manager';
import { IB_PORTS, IB_DEFAULT_HOST, IB_DEFAULT_CLIENT_ID } from '../../exchange/interactive-brokers/constants';

describe('IB Connection Manager', () => {
  describe('Configuration', () => {
    it('should use default configuration when no options provided', () => {
      const manager = getDefaultConnectionManager();

      expect(manager.state.connected).toBe(false);
      expect(manager.state.connecting).toBe(false);
    });

    it('should accept custom configuration', () => {
      const manager = createConnectionManager({
        host: 'custom-host',
        port: IB_PORTS.GATEWAY_LIVE,
        clientId: 123,
      });

      expect(manager.state.connected).toBe(false);
      expect(manager.isConnected).toBe(false);
    });

    it('should initialize with correct default state', () => {
      const manager = new IBConnectionManager();

      expect(manager.state).toEqual({
        connected: false,
        connecting: false,
        reconnecting: false,
      });
    });
  });

  describe('State Management', () => {
    let manager: IBConnectionManager;

    beforeEach(() => {
      manager = new IBConnectionManager();
    });

    it('should expose isConnected property', () => {
      expect(manager.isConnected).toBe(false);
    });

    it('should expose state observable', () => {
      expect(manager.stateObservable).toBeDefined();
    });

    it('should throw when accessing client before connect', () => {
      expect(() => manager.client).toThrow('IB API not initialized');
    });
  });

  describe('Port Configuration', () => {
    it('should have correct port constants', () => {
      expect(IB_PORTS.GATEWAY_LIVE).toBe(4001);
      expect(IB_PORTS.GATEWAY_PAPER).toBe(4002);
      expect(IB_PORTS.TWS_LIVE).toBe(7496);
      expect(IB_PORTS.TWS_PAPER).toBe(7497);
    });

    it('should have correct default host', () => {
      expect(IB_DEFAULT_HOST).toBe('127.0.0.1');
    });

    it('should have correct default client ID', () => {
      expect(IB_DEFAULT_CLIENT_ID).toBe(1);
    });
  });

  describe.skip('Integration Tests (require IB Gateway)', () => {
    it('should connect to IB Gateway paper trading', async () => {
      const manager = createConnectionManager({
        port: IB_PORTS.GATEWAY_PAPER,
      });

      await manager.connect();
      expect(manager.isConnected).toBe(true);
      expect(manager.state.connectionTime).toBeDefined();

      await manager.disconnect();
      expect(manager.isConnected).toBe(false);
    });

    it('should reconnect after disconnect', async () => {
      const manager = createConnectionManager({
        port: IB_PORTS.GATEWAY_PAPER,
      });

      await manager.connect();
      expect(manager.isConnected).toBe(true);

      await manager.reconnect();
      expect(manager.isConnected).toBe(true);

      await manager.disconnect();
    });

    it('should get managed accounts', async () => {
      const manager = createConnectionManager({
        port: IB_PORTS.GATEWAY_PAPER,
      });

      await manager.connect();

      const accounts = await manager.getManagedAccounts();
      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts.length).toBeGreaterThan(0);

      await manager.disconnect();
    });

    it('should get current server time', async () => {
      const manager = createConnectionManager({
        port: IB_PORTS.GATEWAY_PAPER,
      });

      await manager.connect();

      const time = await manager.getCurrentTime();
      expect(time).toBeGreaterThan(0);

      await manager.disconnect();
    });

    it('should handle connection timeout', async () => {
      const manager = createConnectionManager({
        host: '10.255.255.1',
        connectionTimeout: 1000,
      });

      await expect(manager.connect()).rejects.toThrow();
      expect(manager.state.lastError).toBeDefined();
    });

    it('should emit state changes via observable', async () => {
      const manager = createConnectionManager({
        port: IB_PORTS.GATEWAY_PAPER,
      });

      const states: boolean[] = [];
      const subscription = manager.stateObservable.subscribe((state) => {
        states.push(state.connected);
      });

      await manager.connect();
      await manager.disconnect();

      subscription.unsubscribe();
      expect(states).toContain(true);
      expect(states).toContain(false);
    });
  });
});
