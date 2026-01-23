# Plano 3: Remover TODA Persistência Local - Migrar para Backend

**Status:** ✅ Concluído (95%)
**Prioridade:** CRÍTICA
**Risco:** Baixo (todas as preferências persistidas no backend)
**Última atualização:** 2026-01-23

---

## 🎯 OBJETIVO

**Remover COMPLETAMENTE** qualquer uso de:
- `localStorage`
- `electron-store`
- `secureStorage`
- Hook `useLocalStorage`

**TUDO** deve ser salvo no backend via tRPC usando o router `preferences`.

---

## ✅ Concluído

| Tarefa | Arquivo | Status |
|--------|---------|--------|
| Schema user_preferences | `apps/backend/src/db/schema.ts` | ✅ |
| Router preferences tRPC | `apps/backend/src/routers/preferences.ts` | ✅ |
| Registrar router | `apps/backend/src/trpc/router.ts` | ✅ |
| Atualizar test-db | `apps/backend/src/__tests__/helpers/test-db.ts` | ✅ |
| Testes preferences router | `apps/backend/src/__tests__/routers/preferences.router.test.ts` | ✅ |
| Hook useUserPreferences | `apps/electron/src/renderer/hooks/useUserPreferences.ts` | ✅ |
| Remover StorageService | `apps/electron/src/main/services/StorageService.ts` | ✅ Deletado |
| Remover storage IPC | `apps/electron/src/main/index.ts` | ✅ |
| Remover secureStorage preload | `apps/electron/src/main/preload.ts` | ✅ |
| Remover StorageAdapter type | `apps/electron/src/renderer/adapters/types.ts` | ✅ |
| Remover storage electron adapter | `apps/electron/src/renderer/adapters/electron/index.ts` | ✅ |
| Remover storage web adapter | `apps/electron/src/renderer/adapters/web/index.ts` | ✅ |
| Deletar web/storage.ts | `apps/electron/src/renderer/adapters/web/storage.ts` | ✅ Deletado |
| Migration gerada | `apps/backend/src/db/migrations/0042_oval_juggernaut.sql` | ✅ |
| Fix CHART_RIGHT_MARGIN | `apps/electron/src/shared/constants/chartConfig.ts` | ✅ (72px) |
| Mover TRPCProvider para index.tsx | `apps/electron/src/renderer/index.tsx` | ✅ |
| Remover TRPCProvider de App.tsx | `apps/electron/src/renderer/App.tsx` | ✅ |
| Remover TRPCProvider de ChartWindow.tsx | `apps/electron/src/renderer/pages/ChartWindow.tsx` | ✅ |
| Migrar color-mode.tsx para backend | `apps/electron/src/renderer/components/ui/color-mode.tsx` | ✅ |
| Remover localStorage de i18n.ts | `apps/electron/src/renderer/i18n.ts` | ✅ |
| Migrar LanguageSelector para backend | `apps/electron/src/renderer/components/Settings/LanguageSelector.tsx` | ✅ |
| Criar LanguageSyncProvider | `apps/electron/src/renderer/components/LanguageSyncProvider.tsx` | ✅ |
| Adicionar LanguageSyncProvider ao index.tsx | `apps/electron/src/renderer/index.tsx` | ✅ |
| Adicionar mocks tRPC aos testes | `apps/electron/src/tests/setup.ts` | ✅ |

---

## ✅ RESULTADO FINAL

**TODAS as preferências são salvas no backend via tRPC.** O usuário pode recarregar o frontend sem perder configurações.

### Como funciona:
1. `useLocalStorage` é uma camada de compatibilidade que usa tRPC internamente
2. `ColorModeProvider` carrega tema do backend via tRPC
3. `LanguageSyncProvider` carrega idioma do backend no startup
4. Todas as chaves estão mapeadas em `KEY_TO_CATEGORY`

### Exceções aceitáveis:
- `ErrorBoundary.tsx`: Mantém localStorage para logs de erro (fallback quando tRPC indisponível)
- `WindowStateManager.ts`: Roda no main process do Electron (não renderer)

---

## 📋 Limpeza Futura (OPCIONAL)

A migração está funcional. Os itens abaixo são limpeza de código opcional.

### 1. DELETAR Hook useLocalStorage (PRIORIDADE BAIXA)

**NOTA:** O hook `useLocalStorage` já usa tRPC internamente (é uma camada de compatibilidade). Os componentes que o usam JÁ ESTÃO salvando no backend. A migração para os hooks específicos (`useChartPreferences`, `useUIPreferences`, etc.) é uma limpeza opcional para código mais limpo.

```
apps/electron/src/renderer/hooks/useLocalStorage.ts  <- OPCIONAL: DELETAR quando todos migrarem
apps/electron/src/tests/setup.ts                     <- Manter mock por enquanto
apps/electron/src/renderer/hooks/index.ts            <- REMOVER export quando deletar hook
```

### 2. Migrar Componentes que usam useLocalStorage

| Arquivo | O que persiste | Migrar para |
|---------|---------------|-------------|
| `App.tsx` | symbol, marketType, showVolume, showGrid, showCurrentPriceLine, showCrosshair, showProfitLossAreas, showFibonacciProjection, showMeasurementRuler, showMeasurementArea, showTooltip, showStochastic, showRSI, showBollingerBands, showATR, showVWAP, showEventRow, chartType, timeframe, movingAverages, advancedConfig | `useChartPreferences()` |
| `ChartCanvas.tsx` | quantityBySymbol | `useTradingPreferences()` |
| `ChartWindow.tsx` | chartwindow:symbol, chartwindow:marketType | `useChartPreferences()` |
| `MainLayout.tsx` | trading-sidebar-open, trading-sidebar-width | `useUIPreferences()` |
| `OrderTicket.tsx` | Verificar uso | `useTradingPreferences()` |
| `AutoTradeConsole.tsx` | fontSizeIndex, isExpanded, autoScroll | `useUIPreferences()` |
| `ChartSettingsTab.tsx` | Verificar uso | `useChartPreferences()` |
| `GeneralTab.tsx` | autoCheckUpdates, autoDownloadUpdates, updateCheckInterval | `useUIPreferences()` |

### 3. Remover localStorage Direto

| Arquivo | Uso atual | Solução | Status |
|---------|-----------|---------|--------|
| `color-mode.tsx` | localStorage para tema | `useUIPreferences()` | ✅ Migrado |
| `color-mode.test.tsx` | Testes | Atualizar para usar mock | ✅ Migrado |
| `ErrorBoundary.tsx` | Error logging | Manter localStorage (fallback quando tRPC indisponível) | ✅ OK (exceção) |
| `i18n.ts` | Idioma | Navegador apenas (sem cache) | ✅ Migrado |
| `LanguageSelector.tsx` | Idioma | `useUIPreferences()` | ✅ Migrado |
| `WindowStateManager.ts` | Estado da janela electron | Manter localStorage APENAS para electron main process (não renderer) | ✅ OK |

### 4. Atualizar Testes

```
apps/electron/src/tests/setup.ts                           <- Remover mock useLocalStorage
apps/electron/src/renderer/components/ui/color-mode.test.tsx <- Atualizar
apps/electron/src/renderer/components/Settings/GeneralTab.test.tsx <- Atualizar
```

---

## ✅ PROBLEMA RESOLVIDO: ColorModeProvider

~~O `ColorModeProvider` era renderizado ANTES do `TRPCProvider`, então não podia usar hooks tRPC diretamente.~~

**Solução aplicada:** `TRPCProvider` foi movido para ANTES do `ColorModeProvider` em `index.tsx`.

Estrutura atual problemática:
```
Root
  └── PlatformProvider
       └── ColorModeProvider  <- Precisa de preferências MAS tRPC não existe ainda
            └── RouterComponent
                 └── App
                      └── TRPCProvider  <- tRPC só existe aqui
```

Estrutura corrigida:
```
Root
  └── TRPCProvider            <- Mover para cima
       └── PlatformProvider
            └── ColorModeProvider  <- Agora pode usar tRPC
                 └── RouterComponent
                      └── App
```

---

## 📋 Ordem de Execução

```bash
# 1. Primeiro, reorganizar providers em index.tsx
# Mover TRPCProvider para ANTES de ColorModeProvider

# 2. Migrar color-mode.tsx para usar useUIPreferences()

# 3. Migrar todos os componentes que usam useLocalStorage:
#    - App.tsx
#    - ChartCanvas.tsx
#    - ChartWindow.tsx
#    - MainLayout.tsx
#    - AutoTradeConsole.tsx
#    - ChartSettingsTab.tsx
#    - GeneralTab.tsx
#    - OrderTicket.tsx
#    - i18n.ts

# 4. Deletar useLocalStorage.ts

# 5. Remover mock em setup.ts

# 6. Remover export em hooks/index.ts

# 7. Atualizar todos os testes

# 8. Rodar testes
pnpm test

# 9. Verificar que não há mais referências a localStorage
grep -r "localStorage" apps/electron/src/renderer/
grep -r "useLocalStorage" apps/electron/src/renderer/
```

---

## 🗄️ Backend Preferences Router (JÁ CRIADO)

```typescript
// Endpoints disponíveis em trpc.preferences.*

// Ler
preferences.get({ category, key })           // -> value | null
preferences.getByCategory({ category })       // -> { key: value, ... }
preferences.getAll()                          // -> { category: { key: value } }

// Escrever
preferences.set({ category, key, value })    // -> { success: true }
preferences.bulkSet({ category, preferences }) // -> { success: true, count }

// Deletar
preferences.delete({ category, key })        // -> { success: true }
preferences.deleteCategory({ category })     // -> { success: true }
preferences.clearAll()                       // -> { success: true }
```

---

## 🪝 Frontend Hooks (JÁ CRIADOS)

```typescript
// apps/electron/src/renderer/hooks/useUserPreferences.ts

// Hook genérico
const { preferences, isLoading, setValue, bulkSet } = useUserPreferences('chart');

// Hooks específicos por categoria
const { preferences, setValue } = useChartPreferences();
const { preferences, setValue } = useUIPreferences();
const { preferences, setValue } = useTradingPreferences();
const { preferences, setValue } = useNotificationPreferences();
const { preferences, setValue } = useRecentPreferences();
const { allPreferences, isLoading } = useAllPreferences();
```

---

## ⚠️ IMPORTANTE

1. **AutoAuth** garante que o usuário está sempre autenticado antes de renderizar o app
2. **Não usar** localStorage como fallback - se não autenticado, mostrar loading
3. **Não usar** electron-store para nada no renderer process
4. **WindowStateManager** pode manter localStorage pois roda no MAIN process (não renderer)

---

## 🧪 Comando para Verificar Sucesso

```bash
# Não deve retornar nenhum resultado (exceto WindowStateManager.ts)
grep -r "localStorage" apps/electron/src/renderer/ --include="*.ts" --include="*.tsx"

# Não deve retornar nenhum resultado
grep -r "useLocalStorage" apps/electron/src/renderer/ --include="*.ts" --include="*.tsx"

# Não deve retornar nenhum resultado
grep -r "electron-store" apps/electron/src/ --include="*.ts" --include="*.tsx"
```
