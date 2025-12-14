# Multi-Asset Auto-Trading with Trading Profiles

## Objetivo
Permitir auto-trading em múltiplos ativos simultaneamente, cada um com seu próprio conjunto de setups habilitados através de Trading Profiles reutilizáveis.

## Arquitetura Atual (Resumo)

```
autoTradingConfig (1 por wallet)
├── enabledSetupTypes: JSON array (global para todos os watchers)
├── maxConcurrentPositions, maxPositionSize, dailyLossLimit
└── isEnabled: boolean

activeWatchers (N por wallet)
├── symbol, interval, walletId
└── Herda enabledSetupTypes do autoTradingConfig (sem override)
```

**Limitação**: Todos os watchers de uma wallet usam os mesmos setups.

---

## Nova Arquitetura Proposta

```
tradingProfiles (N por user)
├── id, userId, name, description
├── enabledSetupTypes: JSON array
├── riskSettings: JSON (optional overrides)
└── isDefault: boolean

activeWatchers (N por wallet)
├── symbol, interval, walletId
└── profileId → tradingProfiles (nullable, null = usa config global)

autoTradingConfig (1 por wallet) - mantido para backward compatibility
└── Serve como "default profile" quando watcher.profileId = null
```

---

## Database Schema

### Nova Tabela: `trading_profiles`

```typescript
export const tradingProfiles = pgTable('trading_profiles', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar({ length: 100 }).notNull(),
  description: text('description'),
  enabledSetupTypes: text('enabled_setup_types').notNull(), // JSON array

  // Optional risk overrides (null = use wallet defaults)
  maxPositionSize: numeric('max_position_size', { precision: 10, scale: 2 }),
  maxConcurrentPositions: integer('max_concurrent_positions'),

  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('trading_profiles_user_id_idx').on(table.userId),
}));
```

### Modificar Tabela: `active_watchers`

```typescript
// Adicionar coluna
profileId: varchar('profile_id', { length: 255 })
  .references(() => tradingProfiles.id, { onDelete: 'set null' }),
```

---

## TypeScript Types

### `packages/types/src/tradingProfile.ts`

```typescript
export interface TradingProfile {
  id: string;
  userId: string;
  name: string;
  description?: string;
  enabledSetupTypes: string[];
  maxPositionSize?: number;
  maxConcurrentPositions?: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  description?: string;
  enabledSetupTypes?: string[];
  maxPositionSize?: number;
  maxConcurrentPositions?: number;
  isDefault?: boolean;
}

export interface WatcherWithProfile {
  id: string;
  symbol: string;
  interval: string;
  profileId?: string;
  profileName?: string;
  enabledSetupTypes: string[];
}
```

---

## Backend Router

### `apps/backend/src/routers/trading-profiles.ts`

```typescript
export const tradingProfilesRouter = router({
  // CRUD
  list: protectedProcedure.query(...)           // Lista profiles do user
  get: protectedProcedure.input(z.object({ id })).query(...)
  create: protectedProcedure.input(createSchema).mutation(...)
  update: protectedProcedure.input(updateSchema).mutation(...)
  delete: protectedProcedure.input(z.object({ id })).mutation(...)

  // Profile assignment
  assignToWatcher: protectedProcedure
    .input(z.object({
      watcherId: z.string(),
      profileId: z.string().nullable()
    }))
    .mutation(...)

  // Duplicate profile
  duplicate: protectedProcedure
    .input(z.object({ id: z.string(), newName: z.string() }))
    .mutation(...)
});
```

### Modificar: `apps/backend/src/routers/auto-trading.ts`

```typescript
// startWatcher - adicionar profileId opcional
startWatcher: protectedProcedure
  .input(z.object({
    walletId: z.string(),
    symbol: z.string(),
    interval: z.string(),
    profileId: z.string().optional(), // NOVO
  }))
  .mutation(...)

// getWatcherStatus - retornar profile info
getWatcherStatus: protectedProcedure
  .input(z.object({ walletId: z.string() }))
  .query(async ({ ctx, input }) => {
    // Retornar watchers com profileId e profileName
  })
```

---

## Scheduler Changes

### `apps/backend/src/services/auto-trading-scheduler.ts`

#### Interface ActiveWatcher (modificar)

```typescript
interface ActiveWatcher {
  walletId: string;
  userId: string;
  symbol: string;
  interval: string;
  enabledStrategies: string[];
  profileId?: string;           // NOVO
  profileName?: string;         // NOVO
  intervalId: NodeJS.Timeout;
  lastProcessedTime: number;
}
```

#### startWatcher (modificar)

```typescript
async startWatcher(
  walletId: string,
  userId: string,
  symbol: string,
  interval: string,
  profileId?: string,          // NOVO
  skipDbPersist: boolean = false
): Promise<void> {
  // ...existing code...

  // Determinar quais strategies usar
  let enabledStrategies: string[];
  let profileName: string | undefined;

  if (profileId) {
    const profile = await db.select()
      .from(tradingProfiles)
      .where(eq(tradingProfiles.id, profileId))
      .limit(1);

    if (profile[0]) {
      enabledStrategies = JSON.parse(profile[0].enabledSetupTypes);
      profileName = profile[0].name;
    } else {
      // Fallback to global config
      enabledStrategies = JSON.parse(config.enabledSetupTypes);
    }
  } else {
    enabledStrategies = JSON.parse(config.enabledSetupTypes);
  }

  // ...rest of code using enabledStrategies...
}
```

#### processWatcher (modificar)

```typescript
private async processWatcher(watcher: ActiveWatcher): Promise<void> {
  // Usar watcher.enabledStrategies (já carregado do profile)
  // Em vez de recarregar config.enabledSetupTypes
}
```

---

## Frontend Components

### 1. `TradingProfilesManager.tsx` (NOVO)

Componente principal para gerenciar profiles:

```
┌─────────────────────────────────────────────────────────────┐
│ Trading Profiles                              [+ New Profile]│
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ ⭐ BTC Trend Following                        [Edit] [⋮] ││
│ │ Setups: LW 9.1, 9.2, Keltner Breakout                    ││
│ │ Max Position: 15% · Max Concurrent: 2                    ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Altcoin Mean-Reversion                        [Edit] [⋮] ││
│ │ Setups: BB Mean-Rev, RSI2 Mean-Rev                       ││
│ │ Max Position: 5% · Max Concurrent: 3                     ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Conservative (Default)                        [Edit] [⋮] ││
│ │ Setups: LW 9.1 only                                      ││
│ │ Using wallet defaults                                    ││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 2. `ProfileEditorDialog.tsx` (NOVO)

Dialog para criar/editar profile:

```
┌─────────────────────────────────────────────────────────────┐
│ Edit Profile                                           [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Name: [BTC Trend Following____________]                     │
│                                                              │
│ Description: [For trending markets on BTC___]               │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│ Enabled Setups:                                    3/12     │
│                                                              │
│ ☑ Larry Williams 9.1        ☐ BB Mean-Reversion            │
│ ☑ Larry Williams 9.2        ☐ RSI2 Mean-Reversion          │
│ ☐ Larry Williams 9.3        ☑ Keltner Breakout             │
│ ☐ Larry Williams 9.4        ☐ Bollinger Breakout           │
│ ☐ Williams Momentum         ☐ Elder Ray                    │
│ ☐ TEMA Momentum             ☐ Supertrend                   │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│ Risk Overrides (optional):                                  │
│                                                              │
│ ☐ Override max position size: [___]%                        │
│ ☐ Override max concurrent:    [___]                         │
│                                                              │
│ ☐ Set as default profile                                    │
│                                                              │
│                              [Cancel]  [Save Profile]       │
└─────────────────────────────────────────────────────────────┘
```

### 3. `WatcherManager.tsx` (NOVO ou modificar WalletManager)

Gerenciar watchers com seleção de profile:

```
┌─────────────────────────────────────────────────────────────┐
│ Active Watchers                               [+ Add Watcher]│
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ 🟢 BTCUSDT · 1d                                          ││
│ │ Profile: [BTC Trend Following ▼]           [Stop] [Edit] ││
│ │ Setups: LW 9.1, 9.2, Keltner                             ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ 🟢 ETHUSDT · 4h                                          ││
│ │ Profile: [Altcoin Mean-Reversion ▼]        [Stop] [Edit] ││
│ │ Setups: BB Mean-Rev, RSI2                                ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ ⚪ SOLUSDT · 1d                            [Stopped]      ││
│ │ Profile: [Use Default ▼]                  [Start] [Edit] ││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 4. `AddWatcherDialog.tsx` (NOVO)

```
┌─────────────────────────────────────────────────────────────┐
│ Add New Watcher                                        [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Symbol:   [BTCUSDT ▼] (with search)                         │
│                                                              │
│ Interval: [1d ▼]                                            │
│           ○ 1m  ○ 5m  ○ 15m  ○ 1h  ○ 4h  ● 1d              │
│                                                              │
│ Profile:  [BTC Trend Following ▼]                           │
│           ☐ Use wallet default                              │
│                                                              │
│                              [Cancel]  [Start Watcher]      │
└─────────────────────────────────────────────────────────────┘
```

### 5. Hook: `useTradingProfiles.ts` (NOVO)

```typescript
export const useTradingProfiles = () => {
  const queryClient = useQueryClient();

  const profiles = useQuery({
    queryKey: ['tradingProfiles'],
    queryFn: () => trpc.tradingProfiles.list.query(),
  });

  const createProfile = useMutation({
    mutationFn: (data: CreateTradingProfileInput) =>
      trpc.tradingProfiles.create.mutate(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tradingProfiles'] }),
  });

  const updateProfile = useMutation({...});
  const deleteProfile = useMutation({...});
  const duplicateProfile = useMutation({...});
  const assignToWatcher = useMutation({...});

  return { profiles, createProfile, updateProfile, deleteProfile, ... };
};
```

---

## Integração na Settings

### Modificar `SettingsDialog.tsx`

Adicionar nova tab "Trading Profiles" entre "Algorithmic Auto Trading" e "Market Context":

```typescript
<Tabs.Trigger value="tradingProfiles">{t('settings.tabs.tradingProfiles')}</Tabs.Trigger>

<Tabs.Content value="tradingProfiles">
  <TradingProfilesTab />
</Tabs.Content>
```

---

## Fases de Implementação

### Fase 1: Database & Types
1. Criar migration para `trading_profiles` table
2. Adicionar coluna `profile_id` em `active_watchers`
3. Criar types em `packages/types/src/tradingProfile.ts`
4. Exportar types no index

### Fase 2: Backend Router
1. Criar `trading-profiles.ts` router com CRUD
2. Registrar router no `router.ts`
3. Modificar `auto-trading.ts` para aceitar profileId no startWatcher
4. Modificar getWatcherStatus para retornar profile info

### Fase 3: Scheduler Integration
1. Modificar `ActiveWatcher` interface
2. Modificar `startWatcher()` para carregar profile
3. Modificar `processWatcher()` para usar strategies do profile
4. Modificar `restoreWatchersFromDb()` para restaurar com profile

### Fase 4: Frontend - Profiles
1. Criar hook `useTradingProfiles`
2. Criar `TradingProfilesManager.tsx`
3. Criar `ProfileEditorDialog.tsx`
4. Adicionar translations

### Fase 5: Frontend - Watchers
1. Criar `WatcherManager.tsx` ou integrar em WalletManager
2. Criar `AddWatcherDialog.tsx`
3. Modificar `useBackendAutoTrading` para profiles
4. Adicionar translations

### Fase 6: Settings Integration
1. Criar `TradingProfilesTab.tsx`
2. Adicionar tab no `SettingsDialog.tsx`

---

## Arquivos a Modificar/Criar

### Backend (7 arquivos)
| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `apps/backend/src/db/schema.ts` | Modificar | Adicionar tradingProfiles table, profileId em activeWatchers |
| `apps/backend/src/routers/trading-profiles.ts` | **Criar** | CRUD router para profiles |
| `apps/backend/src/routers/auto-trading.ts` | Modificar | Aceitar profileId, retornar profile info |
| `apps/backend/src/trpc/router.ts` | Modificar | Registrar tradingProfiles router |
| `apps/backend/src/services/auto-trading-scheduler.ts` | Modificar | Usar profile no watcher |
| `apps/backend/drizzle/migrations/XXXX_trading_profiles.sql` | **Criar** | Migration |

### Types (2 arquivos)
| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `packages/types/src/tradingProfile.ts` | **Criar** | Types do profile |
| `packages/types/src/index.ts` | Modificar | Export types |

### Frontend (8 arquivos)
| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `apps/electron/.../hooks/useTradingProfiles.ts` | **Criar** | Hook para profiles |
| `apps/electron/.../components/Trading/TradingProfilesManager.tsx` | **Criar** | Lista de profiles |
| `apps/electron/.../components/Trading/ProfileEditorDialog.tsx` | **Criar** | Editor de profile |
| `apps/electron/.../components/Trading/WatcherManager.tsx` | **Criar** | Gerenciar watchers |
| `apps/electron/.../components/Trading/AddWatcherDialog.tsx` | **Criar** | Adicionar watcher |
| `apps/electron/.../components/Settings/TradingProfilesTab.tsx` | **Criar** | Tab de settings |
| `apps/electron/.../components/Settings/SettingsDialog.tsx` | Modificar | Adicionar nova tab |
| `apps/electron/.../hooks/useBackendAutoTrading.ts` | Modificar | Aceitar profileId |

### Translations (4 arquivos)
| Arquivo | Ação |
|---------|------|
| `apps/electron/src/renderer/locales/en/translation.json` | Modificar |
| `apps/electron/src/renderer/locales/pt/translation.json` | Modificar |
| `apps/electron/src/renderer/locales/es/translation.json` | Modificar |
| `apps/electron/src/renderer/locales/fr/translation.json` | Modificar |

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Breaking change em watchers existentes | Alta | Alto | profileId nullable, null = usa config global |
| Conflito de posições entre watchers | Média | Alto | maxConcurrentPositions é global por wallet |
| Profile deletado com watchers ativos | Média | Médio | ON DELETE SET NULL, fallback para global |
| Performance com muitos watchers | Baixa | Médio | Cache de profiles, já tem cache de klines |
| UI complexa demais | Média | Médio | Começar com UI simples, iterar |

---

## Backward Compatibility

1. **Watchers existentes**: `profileId = null` → usa `autoTradingConfig.enabledSetupTypes`
2. **autoTradingConfig mantido**: Continua funcionando como "default profile"
3. **Migration segura**: Apenas adiciona coluna nullable
4. **API endpoints existentes**: Funcionam sem mudança (profileId é opcional)

---

## Estimativa de Esforço

| Fase | Complexidade | Arquivos |
|------|--------------|----------|
| Fase 1: Database & Types | Baixa | 3 |
| Fase 2: Backend Router | Média | 3 |
| Fase 3: Scheduler | Média | 1 |
| Fase 4: Frontend Profiles | Alta | 4 |
| Fase 5: Frontend Watchers | Alta | 4 |
| Fase 6: Settings | Baixa | 2 |
| **Total** | **~17 arquivos** | |
