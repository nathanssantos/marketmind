import pino from 'pino';

const isProduction = process.env['NODE_ENV'] === 'production';

export const auditLogger = pino({
  name: 'security-audit',
  level: 'info',
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: true,
        },
      },
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: 'security-audit',
  },
});

export enum SecurityEvent {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  REGISTER_SUCCESS = 'REGISTER_SUCCESS',
  REGISTER_FAILURE = 'REGISTER_FAILURE',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_INVALIDATED = 'SESSION_INVALIDATED',
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_DELETED = 'API_KEY_DELETED',
  API_KEY_ROTATED = 'API_KEY_ROTATED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  WALLET_CREATED = 'WALLET_CREATED',
  WALLET_DELETED = 'WALLET_DELETED',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS',
  PASSWORD_RESET_FAILURE = 'PASSWORD_RESET_FAILURE',
  EMAIL_VERIFICATION_SENT = 'EMAIL_VERIFICATION_SENT',
  EMAIL_VERIFICATION_SUCCESS = 'EMAIL_VERIFICATION_SUCCESS',
  TWO_FACTOR_SENT = 'TWO_FACTOR_SENT',
  TWO_FACTOR_SUCCESS = 'TWO_FACTOR_SUCCESS',
  TWO_FACTOR_FAILURE = 'TWO_FACTOR_FAILURE',
  TWO_FACTOR_TOGGLED = 'TWO_FACTOR_TOGGLED',
}

export interface SecurityEventMetadata {
  ip?: string;
  userAgent?: string;
  email?: string;
  reason?: string;
  walletId?: string;
  apiKeyId?: string;
  [key: string]: unknown;
}

export const logSecurityEvent = (
  event: SecurityEvent,
  userId: string | null,
  metadata: SecurityEventMetadata = {}
): void => {
  const logData = {
    event,
    userId,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  switch (event) {
    case SecurityEvent.LOGIN_FAILURE:
    case SecurityEvent.REGISTER_FAILURE:
    case SecurityEvent.PASSWORD_RESET_FAILURE:
    case SecurityEvent.TWO_FACTOR_FAILURE:
    case SecurityEvent.RATE_LIMIT_EXCEEDED:
    case SecurityEvent.SUSPICIOUS_ACTIVITY:
    case SecurityEvent.UNAUTHORIZED_ACCESS:
      auditLogger.warn(logData, `Security event: ${event}`);
      break;
    default:
      auditLogger.info(logData, `Security event: ${event}`);
  }
};

export const extractRequestMetadata = (req: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}): Pick<SecurityEventMetadata, 'ip' | 'userAgent'> => {
  const userAgentHeader = req.headers?.['user-agent'];
  return {
    ip: req.ip ?? 'unknown',
    userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader,
  };
};
