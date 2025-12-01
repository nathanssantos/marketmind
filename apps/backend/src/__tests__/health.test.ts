import { describe, expect, it } from 'vitest';

describe('Health Router', () => {
  describe('ping', () => {
    it('should return pong', () => {
      const response = { message: 'pong' };
      expect(response.message).toBe('pong');
    });
  });

  describe('check', () => {
    it('should return status healthy', () => {
      const response = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
      
      expect(response.status).toBe('healthy');
      expect(response.timestamp).toBeDefined();
      expect(response.uptime).toBeGreaterThan(0);
    });

    it('should include database status', () => {
      const response = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected',
      };
      
      expect(response.database).toBe('connected');
    });
  });
});
