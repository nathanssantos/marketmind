# Plano 3: Preparação para Web/Mobile

**Status:** Planejado
**Prioridade:** 4 (Expansão futura)
**Risco:** Alto
**Arquivos estimados:** ~20
**Testes novos:** ~40

---

## Objetivo

Garantir que o app possa ser buildado para web e preparar estrutura para React Native futuro.

---

## Estado Atual

### Pontos Positivos (já implementados)

| Componente | Status | Localização |
|------------|--------|-------------|
| Adapter Pattern | ✅ Implementado | `apps/electron/src/renderer/adapters/` |
| Web Storage Adapter | ✅ Implementado | `adapters/web/storage.ts` |
| Web Update Adapter | ✅ Implementado | `adapters/web/update.ts` (Service Worker) |
| Web Notification Adapter | ✅ Implementado | `adapters/web/notification.ts` |
| Web Window Adapter | ✅ Implementado | `adapters/web/window.ts` |
| Web HTTP Adapter | ✅ Implementado | `adapters/web/http.ts` |
| Build Config | ✅ Suporta | `VITE_TARGET=web` |
| Router Abstraction | ✅ Implementado | HashRouter vs BrowserRouter |

### Bloqueadores Identificados

| Área | Arquivo | Dependência | Problema |
|------|---------|-------------|----------|
| Trading Data | `main/services/StorageService.ts` | electron-store + safeStorage | Dados perdidos em web |
| Window State | `main/services/WindowStateManager.ts` | electron.screen | Não existe em web |
| IPC Handlers | `main/index.ts:338-633` | ipcMain/ipcRenderer | Não existe em web |
| Auto Update | `main/services/UpdateManager.ts` | electron-updater | Precisa Service Worker |

---

## Dados a Migrar para Backend

### Mapeamento Atual → Futuro

| Dado | Storage Atual | Nova Localização | Prioridade |
|------|---------------|------------------|------------|
| Trading Data | electron-store | `user_preferences` table | Alta |
| UI Preferences | localStorage | `user_preferences` table | Média |
| Chart Settings | localStorage | `user_preferences` table | Média |
| Recent Symbols | localStorage | `user_preferences` table | Baixa |
| Window State | electron-store | N/A (web não precisa) | - |

### Categorias de Preferências

```typescript
type PreferenceCategory =
  | 'trading'        // Trading configs, risk settings
  | 'ui'             // Theme, sidebar state, panel sizes
  | 'chart'          // Chart settings, indicators, timeframes
  | 'notifications'  // Alert preferences
  | 'recent'         // Recently viewed symbols, searches
  ;
```

---

## Ações Planejadas

### 1. Criar Tabela `user_preferences`

**Arquivo:** `apps/backend/src/db/schema.ts`

```typescript
import { pgTable, serial, integer, text, jsonb, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userPreferences = pgTable('user_preferences', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueUserCategoryKey: unique().on(table.userId, table.category, table.key),
}));

export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;
```

**Migration:**

```sql
CREATE TABLE user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, category, key)
);

CREATE INDEX idx_user_preferences_user_category ON user_preferences(user_id, category);
```

---

### 2. Criar Router tRPC para Preferences

**Arquivo:** `apps/backend/src/routers/preferences.ts`

```typescript
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { userPreferences } from '../db/schema';

const categorySchema = z.enum(['trading', 'ui', 'chart', 'notifications', 'recent']);

export const preferencesRouter = router({
  get: protectedProcedure
    .input(z.object({
      category: categorySchema,
      key: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const pref = await ctx.db.query.userPreferences.findFirst({
        where: and(
          eq(userPreferences.userId, ctx.user.id),
          eq(userPreferences.category, input.category),
          eq(userPreferences.key, input.key),
        ),
      });
      return pref?.value ?? null;
    }),

  getByCategory: protectedProcedure
    .input(z.object({ category: categorySchema }))
    .query(async ({ ctx, input }) => {
      const prefs = await ctx.db.query.userPreferences.findMany({
        where: and(
          eq(userPreferences.userId, ctx.user.id),
          eq(userPreferences.category, input.category),
        ),
      });
      return Object.fromEntries(prefs.map(p => [p.key, p.value]));
    }),

  set: protectedProcedure
    .input(z.object({
      category: categorySchema,
      key: z.string(),
      value: z.unknown(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [pref] = await ctx.db
        .insert(userPreferences)
        .values({
          userId: ctx.user.id,
          category: input.category,
          key: input.key,
          value: input.value,
        })
        .onConflictDoUpdate({
          target: [userPreferences.userId, userPreferences.category, userPreferences.key],
          set: { value: input.value, updatedAt: new Date() },
        })
        .returning();
      return pref;
    }),

  delete: protectedProcedure
    .input(z.object({
      category: categorySchema,
      key: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(userPreferences)
        .where(and(
          eq(userPreferences.userId, ctx.user.id),
          eq(userPreferences.category, input.category),
          eq(userPreferences.key, input.key),
        ));
      return { success: true };
    }),

  bulkSet: protectedProcedure
    .input(z.object({
      category: categorySchema,
      preferences: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ ctx, input }) => {
      const entries = Object.entries(input.preferences);

      await Promise.all(entries.map(([key, value]) =>
        ctx.db
          .insert(userPreferences)
          .values({
            userId: ctx.user.id,
            category: input.category,
            key,
            value,
          })
          .onConflictDoUpdate({
            target: [userPreferences.userId, userPreferences.category, userPreferences.key],
            set: { value, updatedAt: new Date() },
          })
      ));

      return { success: true, count: entries.length };
    }),
});
```

---

### 3. Criar Hook `useUserPreferences`

**Arquivo:** `apps/electron/src/renderer/hooks/useUserPreferences.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '../services/trpc';

type Category = 'trading' | 'ui' | 'chart' | 'notifications' | 'recent';

export const useUserPreferences = (category: Category) => {
  const queryClient = useQueryClient();
  const queryKey = ['preferences', category];

  const preferences = useQuery({
    queryKey,
    queryFn: () => trpc.preferences.getByCategory.query({ category }),
  });

  const setPreference = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      trpc.preferences.set.mutate({ category, key, value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deletePreference = useMutation({
    mutationFn: (key: string) =>
      trpc.preferences.delete.mutate({ category, key }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const bulkSet = useMutation({
    mutationFn: (prefs: Record<string, unknown>) =>
      trpc.preferences.bulkSet.mutate({ category, preferences: prefs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    preferences: preferences.data ?? {},
    isLoading: preferences.isLoading,
    error: preferences.error,
    get: <T>(key: string, defaultValue: T): T =>
      (preferences.data?.[key] as T) ?? defaultValue,
    set: setPreference.mutateAsync,
    delete: deletePreference.mutateAsync,
    bulkSet: bulkSet.mutateAsync,
    isSaving: setPreference.isPending || bulkSet.isPending,
  };
};

// Convenience hooks for specific categories
export const useTradingPreferences = () => useUserPreferences('trading');
export const useUIPreferences = () => useUserPreferences('ui');
export const useChartPreferences = () => useUserPreferences('chart');
```

---

### 4. Atualizar Web Storage Adapter

**Arquivo:** `apps/electron/src/renderer/adapters/web/storage.ts`

```typescript
import type { StorageAdapter } from '../types';

const STORAGE_KEY = 'marketmind-trading-data';
const GUEST_PREFERENCES_KEY = 'marketmind-guest-preferences';

export const createWebStorageAdapter = (): StorageAdapter => ({
  isEncryptionAvailable: async () => false,

  getTradingData: async () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setTradingData: async (data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save trading data:', error);
    }
  },

  clearTradingData: async () => {
    localStorage.removeItem(STORAGE_KEY);
  },

  // Guest preferences (no auth)
  getGuestPreference: async (key: string) => {
    try {
      const prefs = JSON.parse(localStorage.getItem(GUEST_PREFERENCES_KEY) ?? '{}');
      return prefs[key] ?? null;
    } catch {
      return null;
    }
  },

  setGuestPreference: async (key: string, value: unknown) => {
    try {
      const prefs = JSON.parse(localStorage.getItem(GUEST_PREFERENCES_KEY) ?? '{}');
      prefs[key] = value;
      localStorage.setItem(GUEST_PREFERENCES_KEY, JSON.stringify(prefs));
    } catch (error) {
      console.error('Failed to save guest preference:', error);
    }
  },
});
```

---

### 5. Script de Migração

**Arquivo:** `apps/electron/src/renderer/utils/migrateToBackend.ts`

```typescript
import { trpc } from '../services/trpc';

interface MigrationResult {
  success: boolean;
  migratedCategories: string[];
  errors: string[];
}

export const migrateLocalStorageToBackend = async (): Promise<MigrationResult> => {
  const result: MigrationResult = {
    success: true,
    migratedCategories: [],
    errors: [],
  };

  const migrations: { key: string; category: 'trading' | 'ui' | 'chart' }[] = [
    { key: 'marketmind-trading-config', category: 'trading' },
    { key: 'marketmind-ui-state', category: 'ui' },
    { key: 'marketmind-chart-settings', category: 'chart' },
  ];

  for (const { key, category } of migrations) {
    try {
      const data = localStorage.getItem(key);
      if (!data) continue;

      const parsed = JSON.parse(data);
      await trpc.preferences.bulkSet.mutate({
        category,
        preferences: parsed,
      });

      localStorage.removeItem(key);
      result.migratedCategories.push(category);
    } catch (error) {
      result.errors.push(`Failed to migrate ${key}: ${error}`);
      result.success = false;
    }
  }

  // Mark migration complete
  localStorage.setItem('marketmind-migration-v1', JSON.stringify({
    completedAt: new Date().toISOString(),
    categories: result.migratedCategories,
  }));

  return result;
};

export const shouldRunMigration = (): boolean => {
  return !localStorage.getItem('marketmind-migration-v1');
};
```

---

### 6. Validar Build Web

```bash
# Build para web
VITE_TARGET=web pnpm --filter @marketmind/electron build

# Servir localmente
cd apps/electron/dist-web
npx serve

# Testar funcionalidades
# - Login/logout
# - Salvar preferências
# - Carregar preferências após refresh
# - Service Worker updates
```

---

## Arquivos a Criar/Modificar

### Novos Arquivos

| Arquivo | Propósito |
|---------|-----------|
| `apps/backend/src/db/schema/userPreferences.ts` | Schema da tabela |
| `apps/backend/src/routers/preferences.ts` | Router tRPC |
| `apps/electron/src/renderer/hooks/useUserPreferences.ts` | Hook de preferências |
| `apps/electron/src/renderer/utils/migrateToBackend.ts` | Script migração |

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `apps/backend/src/routers/index.ts` | Adicionar preferencesRouter |
| `apps/backend/src/db/schema/index.ts` | Exportar userPreferences |
| `apps/electron/src/renderer/adapters/web/storage.ts` | Adicionar guest prefs |
| `apps/electron/src/renderer/App.tsx` | Chamar migração |

---

## Verificação

### Build Web

- [ ] `pnpm run build:web` completa sem erros
- [ ] Sem referências a `window.electron` em runtime
- [ ] Service Worker registrado corretamente

### Funcionalidades

- [ ] Login/logout funciona em web
- [ ] Preferências salvas no backend
- [ ] Preferências carregadas após refresh
- [ ] Fallback localStorage para guests
- [ ] Migração executa uma vez

### Compatibilidade

- [ ] Chrome, Firefox, Safari testados
- [ ] Mobile responsive funciona
- [ ] PWA instalável

---

## Preparação para React Native

### Adaptações Necessárias (futuro)

| Área | Web | React Native |
|------|-----|--------------|
| Storage | localStorage | AsyncStorage / SecureStore |
| HTTP | fetch | fetch (ou axios) |
| Notifications | Web Notification API | expo-notifications |
| Navigation | react-router | react-navigation |
| Charts | Canvas | react-native-skia |

### Estrutura Recomendada

```
apps/
├── electron/          # Desktop (Electron)
├── web/               # Web (extraído do electron renderer)
└── mobile/            # React Native (futuro)

packages/
├── ui/                # Componentes compartilhados (futuro)
├── trading-core/      # Lógica de trading
└── types/             # Types compartilhados
```

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| localStorage limit (5-10MB) | Média | Médio | Backend storage |
| Service Worker bugs | Baixa | Alto | Testes extensivos |
| Auth flow diferente | Média | Médio | Adapter pattern |
| Performance web vs electron | Média | Médio | Lazy loading, code splitting |

---

## Dependências

- **Depende de:** Backend funcionando
- **Não depende de:** Planos 1, 2, 4
