export interface TradingProfile {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  enabledSetupTypes: string[];
  maxPositionSize?: number | null;
  maxConcurrentPositions?: number | null;
  isDefault: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateTradingProfileInput {
  name: string;
  description?: string;
  enabledSetupTypes: string[];
  maxPositionSize?: number;
  maxConcurrentPositions?: number;
  isDefault?: boolean;
}

export interface UpdateTradingProfileInput {
  name?: string;
  description?: string | null;
  enabledSetupTypes?: string[];
  maxPositionSize?: number | null;
  maxConcurrentPositions?: number | null;
  isDefault?: boolean;
}

export interface WatcherWithProfile {
  id: string;
  symbol: string;
  interval: string;
  walletId: string;
  profileId?: string | null;
  profileName?: string | null;
  enabledSetupTypes: string[];
  startedAt: Date;
  createdAt: Date;
}
