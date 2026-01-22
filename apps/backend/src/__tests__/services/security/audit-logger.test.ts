import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SecurityEvent,
  logSecurityEvent,
  extractRequestMetadata,
  auditLogger,
} from '../../../services/security/audit-logger';

describe('Security Audit Logger', () => {
  beforeEach(() => {
    vi.spyOn(auditLogger, 'info').mockImplementation(() => auditLogger);
    vi.spyOn(auditLogger, 'warn').mockImplementation(() => auditLogger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SecurityEvent enum', () => {
    it('should have all required security events', () => {
      expect(SecurityEvent.LOGIN_SUCCESS).toBe('LOGIN_SUCCESS');
      expect(SecurityEvent.LOGIN_FAILURE).toBe('LOGIN_FAILURE');
      expect(SecurityEvent.LOGOUT).toBe('LOGOUT');
      expect(SecurityEvent.REGISTER_SUCCESS).toBe('REGISTER_SUCCESS');
      expect(SecurityEvent.REGISTER_FAILURE).toBe('REGISTER_FAILURE');
      expect(SecurityEvent.PASSWORD_CHANGE).toBe('PASSWORD_CHANGE');
      expect(SecurityEvent.SESSION_EXPIRED).toBe('SESSION_EXPIRED');
      expect(SecurityEvent.SESSION_INVALIDATED).toBe('SESSION_INVALIDATED');
      expect(SecurityEvent.API_KEY_CREATED).toBe('API_KEY_CREATED');
      expect(SecurityEvent.API_KEY_DELETED).toBe('API_KEY_DELETED');
      expect(SecurityEvent.API_KEY_ROTATED).toBe('API_KEY_ROTATED');
      expect(SecurityEvent.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
      expect(SecurityEvent.SUSPICIOUS_ACTIVITY).toBe('SUSPICIOUS_ACTIVITY');
      expect(SecurityEvent.UNAUTHORIZED_ACCESS).toBe('UNAUTHORIZED_ACCESS');
      expect(SecurityEvent.WALLET_CREATED).toBe('WALLET_CREATED');
      expect(SecurityEvent.WALLET_DELETED).toBe('WALLET_DELETED');
    });
  });

  describe('logSecurityEvent', () => {
    it('should log LOGIN_SUCCESS as info', () => {
      logSecurityEvent(SecurityEvent.LOGIN_SUCCESS, 'user-123', {
        ip: '127.0.0.1',
        email: 'test@example.com',
      });

      expect(auditLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'LOGIN_SUCCESS',
          userId: 'user-123',
          ip: '127.0.0.1',
          email: 'test@example.com',
        }),
        expect.stringContaining('LOGIN_SUCCESS')
      );
    });

    it('should log LOGIN_FAILURE as warn', () => {
      logSecurityEvent(SecurityEvent.LOGIN_FAILURE, null, {
        ip: '192.168.1.1',
        email: 'test@example.com',
        reason: 'invalid_password',
      });

      expect(auditLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'LOGIN_FAILURE',
          userId: null,
          ip: '192.168.1.1',
          reason: 'invalid_password',
        }),
        expect.stringContaining('LOGIN_FAILURE')
      );
    });

    it('should log RATE_LIMIT_EXCEEDED as warn', () => {
      logSecurityEvent(SecurityEvent.RATE_LIMIT_EXCEEDED, null, {
        ip: '10.0.0.1',
        reason: 'login_attempts_exceeded',
      });

      expect(auditLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'RATE_LIMIT_EXCEEDED',
          reason: 'login_attempts_exceeded',
        }),
        expect.stringContaining('RATE_LIMIT_EXCEEDED')
      );
    });

    it('should log SUSPICIOUS_ACTIVITY as warn', () => {
      logSecurityEvent(SecurityEvent.SUSPICIOUS_ACTIVITY, 'user-456', {
        ip: '8.8.8.8',
        reason: 'unusual_access_pattern',
      });

      expect(auditLogger.warn).toHaveBeenCalled();
    });

    it('should log UNAUTHORIZED_ACCESS as warn', () => {
      logSecurityEvent(SecurityEvent.UNAUTHORIZED_ACCESS, null, {
        ip: '1.2.3.4',
        reason: 'invalid_token',
      });

      expect(auditLogger.warn).toHaveBeenCalled();
    });

    it('should log LOGOUT as info', () => {
      logSecurityEvent(SecurityEvent.LOGOUT, 'user-789', {
        ip: '127.0.0.1',
      });

      expect(auditLogger.info).toHaveBeenCalled();
    });

    it('should log REGISTER_SUCCESS as info', () => {
      logSecurityEvent(SecurityEvent.REGISTER_SUCCESS, 'new-user', {
        ip: '127.0.0.1',
        email: 'new@example.com',
      });

      expect(auditLogger.info).toHaveBeenCalled();
    });

    it('should log REGISTER_FAILURE as warn', () => {
      logSecurityEvent(SecurityEvent.REGISTER_FAILURE, null, {
        ip: '127.0.0.1',
        email: 'existing@example.com',
        reason: 'email_already_registered',
      });

      expect(auditLogger.warn).toHaveBeenCalled();
    });

    it('should include timestamp in log data', () => {
      logSecurityEvent(SecurityEvent.LOGIN_SUCCESS, 'user-123', {});

      expect(auditLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
        }),
        expect.any(String)
      );
    });

    it('should handle empty metadata', () => {
      logSecurityEvent(SecurityEvent.LOGOUT, 'user-123');

      expect(auditLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'LOGOUT',
          userId: 'user-123',
        }),
        expect.any(String)
      );
    });
  });

  describe('extractRequestMetadata', () => {
    it('should extract IP and user agent from request', () => {
      const req = {
        ip: '192.168.1.100',
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      };

      const metadata = extractRequestMetadata(req);

      expect(metadata).toEqual({
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
      });
    });

    it('should handle missing IP', () => {
      const req = {
        headers: {
          'user-agent': 'TestAgent/1.0',
        },
      };

      const metadata = extractRequestMetadata(req);

      expect(metadata.ip).toBe('unknown');
      expect(metadata.userAgent).toBe('TestAgent/1.0');
    });

    it('should handle missing headers', () => {
      const req = {
        ip: '10.0.0.1',
      };

      const metadata = extractRequestMetadata(req);

      expect(metadata.ip).toBe('10.0.0.1');
      expect(metadata.userAgent).toBeUndefined();
    });

    it('should handle array user-agent header', () => {
      const req = {
        ip: '127.0.0.1',
        headers: {
          'user-agent': ['Agent1', 'Agent2'],
        },
      };

      const metadata = extractRequestMetadata(req);

      expect(metadata.userAgent).toBe('Agent1');
    });

    it('should handle empty request object', () => {
      const req = {};

      const metadata = extractRequestMetadata(req);

      expect(metadata.ip).toBe('unknown');
      expect(metadata.userAgent).toBeUndefined();
    });
  });
});
