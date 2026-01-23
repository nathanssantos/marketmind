# Plano 3: Preparação para Web/Mobile

**Status:** 🔄 Em Progresso (60%)
**Prioridade:** 4 (Expansão futura)
**Risco:** Alto
**Arquivos estimados:** ~20
**Testes novos:** ~40

---

## Progresso Atual

### ✅ Concluído

| Tarefa | Arquivo | Status |
|--------|---------|--------|
| Schema user_preferences | `apps/backend/src/db/schema.ts` | ✅ Criado |
| Router preferences tRPC | `apps/backend/src/routers/preferences.ts` | ✅ Criado |
| Registrar router | `apps/backend/src/trpc/router.ts` | ✅ Registrado |
| Atualizar test-db | `apps/backend/src/__tests__/helpers/test-db.ts` | ✅ Atualizado |
| Testes preferences router | `apps/backend/src/__tests__/routers/preferences.router.test.ts` | ✅ Criado |
| Hook useUserPreferences | `apps/electron/src/renderer/hooks/useUserPreferences.ts` | ✅ Criado |
| Remover StorageService | `apps/electron/src/main/services/StorageService.ts` | ✅ Deletado |
| Remover storage IPC | `apps/electron/src/main/index.ts` | ✅ Removido |
| Remover storage preload | `apps/electron/src/main/preload.ts` | ✅ Removido |
| Atualizar adapters/types | `apps/electron/src/renderer/adapters/types.ts` | ✅ Removido StorageAdapter |
| Atualizar electron adapter | `apps/electron/src/renderer/adapters/electron/index.ts` | ✅ Removido storage |

### 🔄 Em Progresso

| Tarefa | Arquivo | Status |
|--------|---------|--------|
| Atualizar web adapter | `apps/electron/src/renderer/adapters/web/index.ts` | 🔄 Próximo |
| Deletar web/storage.ts | `apps/electron/src/renderer/adapters/web/storage.ts` | 🔄 Próximo |

### ⏳ Pendente

| Tarefa | Descrição |
|--------|-----------|
| Deletar useLocalStorage hook | `apps/electron/src/renderer/hooks/useLocalStorage.ts` + teste |
| Gerar database migration | `pnpm --filter @marketmind/backend db:generate` |
| Criar sistema de migrations | Sistema organizado para backend |
| Remover código de migration localStorage | Limpar código legado |
| Rodar todos os testes | Verificar que nada quebrou |

---

## Objetivo

Remover TODA dependência de localStorage e electron-store. Todos os dados persistentes devem ser salvos no backend via tRPC.

---

## Schema Criado

```typescript
// apps/backend/src/db/schema.ts
export const userPreferences = pgTable('user_preferences', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  category: varchar({ length: 50 }).notNull(), // 'trading' | 'ui' | 'chart' | 'notifications' | 'recent'
  key: varchar({ length: 100 }).notNull(),
  value: text().notNull(), // JSON stringified
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  uniqueUserCategoryKey: unique().on(table.userId, table.category, table.key),
  userIdCategoryIdx: index('user_preferences_user_id_category_idx').on(table.userId, table.category),
}));
```

---

## Router Criado

```typescript
// apps/backend/src/routers/preferences.ts
// Endpoints disponíveis:
// - preferences.get({ category, key }) -> value | null
// - preferences.getByCategory({ category }) -> Record<string, value>
// - preferences.getAll() -> Record<category, Record<string, value>>
// - preferences.set({ category, key, value }) -> { success: true }
// - preferences.delete({ category, key }) -> { success: true }
// - preferences.bulkSet({ category, preferences }) -> { success: true, count }
// - preferences.deleteCategory({ category }) -> { success: true }
// - preferences.clearAll() -> { success: true }
```

---

## Hook Frontend Criado

```typescript
// apps/electron/src/renderer/hooks/useUserPreferences.ts
// Hooks disponíveis:
// - useUserPreferences(category) - hook genérico
// - useTradingPreferences() - categoria 'trading'
// - useUIPreferences() - categoria 'ui'
// - useChartPreferences() - categoria 'chart'
// - useNotificationPreferences() - categoria 'notifications'
// - useRecentPreferences() - categoria 'recent'
// - useAllPreferences() - todas as preferências
```

---

## Comandos para Continuar

Se o chat travar, execute:

```bash
# 1. Verificar estado atual
cd /Users/nathan/Documents/dev/marketmind

# 2. Ver arquivos modificados
git status

# 3. Continuar implementação:
# - Atualizar apps/electron/src/renderer/adapters/web/index.ts (remover storage)
# - Deletar apps/electron/src/renderer/adapters/web/storage.ts
# - Deletar apps/electron/src/renderer/hooks/useLocalStorage.ts
# - Deletar apps/electron/src/renderer/hooks/useLocalStorage.test.ts

# 4. Gerar migration
cd apps/backend
pnpm db:generate

# 5. Rodar testes
cd ../..
pnpm test
```

---

## Categorias de Preferências

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

## Riscos Mitigados

| Risco | Mitigação |
|-------|-----------|
| Perda de dados | Backend salva tudo em PostgreSQL |
| Sem offline | Users precisam de conexão (aceitável para trading app) |
| Performance | React Query cache + staleTime configurado |
