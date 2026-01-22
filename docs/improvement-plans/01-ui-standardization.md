# Plano de Melhoria: Padronização de UI

## 1. Estado Atual

### 1.1 Inventário de Componentes

**Total: 250 componentes em 19 grupos**

| Categoria | Arquivos | Localização |
|-----------|----------|-------------|
| UI Foundation | 26 | `/components/ui/` |
| Layout | 6 | `/components/Layout/` |
| Trading | 25+ | `/components/Trading/` |
| Chart | 50+ | `/components/Chart/` |
| Settings | 7 | `/components/Settings/` |
| Auth | 1 | `/components/Auth/` |
| Update | 1 | `/components/Update/` |

### 1.2 Componentes Grandes (>500 linhas)

| Componente | Linhas | Problema |
|------------|--------|----------|
| `ChartCanvas.tsx` | 1,902 | 60+ imports, responsabilidades misturadas |
| `WatcherManager.tsx` | 1,607 | 15+ useState, UI complexa |
| `OrdersList.tsx` | 888 | Duplicação card/table |
| `Portfolio.tsx` | 740 | Similar ao OrdersList |
| `ChartTooltip.tsx` | 683 | Muitos conditionals |
| `BacktestConfig.tsx` | 557 | Formulário longo |

### 1.3 Padrões de Dialog Duplicados

8 implementações de dialog com boilerplate repetido:
- AddWatcherDialog (264 linhas)
- CreateWalletDialog (260 linhas)
- ProfileEditorDialog (402 linhas)
- BacktestDialog (35 linhas)
- SettingsDialog (68 linhas)
- KeyboardShortcutsDialog (118 linhas)
- TradingProfilesModal
- WalletPerformanceModal (295 linhas)

---

## 2. Análise Acadêmica

### 2.1 Design Systems - Melhores Práticas

**Referências:**
- "Atomic Design" by Brad Frost (2016)
- "Design Systems" by Alla Kholmatova (O'Reilly, 2017)
- Material Design Guidelines (Google)
- Carbon Design System (IBM)

**Princípios Fundamentais:**

1. **Atomic Design**: Hierarquia de componentes
   - Atoms: Button, Input, Badge
   - Molecules: FormField, SearchInput
   - Organisms: Dialog, Card, Table
   - Templates: PageLayout, SidebarLayout
   - Pages: Dashboard, Settings

2. **Compound Components Pattern** (Kent C. Dodds)
   - Permite composição flexível
   - Estado compartilhado via Context
   - Exemplo: `<Dialog.Root>`, `<Dialog.Content>`

3. **Render Props & Hooks**
   - Separação de lógica e apresentação
   - Reutilização de comportamento

### 2.2 React Performance Best Practices

**Referências:**
- "React Performance Optimization" (React Docs)
- "Optimizing Performance" (Dan Abramov)
- "When to useMemo and useCallback" (Kent C. Dodds)

**Padrões Recomendados:**

1. **Memoização:**
   ```typescript
   // Componentes de lista
   const ListItem = memo(({ item }) => ...);

   // Callbacks passados para children
   const handleClick = useCallback(() => ..., [deps]);

   // Cálculos caros
   const filtered = useMemo(() => filter(items), [items]);
   ```

2. **Code Splitting:**
   ```typescript
   const HeavyComponent = lazy(() => import('./HeavyComponent'));
   ```

3. **Virtualização para listas longas:**
   - react-window ou react-virtualized
   - Renderiza apenas itens visíveis

---

## 3. Benchmarking de Mercado

### 3.1 TradingView

**Pontos fortes:**
- Design system consistente
- Componentes altamente reutilizáveis
- Performance excepcional (WebGL)
- Temas customizáveis

**O que podemos aprender:**
- Separação clara de componentes de chart vs UI
- Sistema de cores semânticas
- Componentes de formulário padronizados

### 3.2 MetaTrader 5

**Pontos fortes:**
- Interface nativa performática
- Painéis redimensionáveis
- Múltiplas janelas

**O que podemos aprender:**
- Organização de painéis
- Gerenciamento de estado de janelas

### 3.3 Chakra UI Best Practices

**Referências:**
- Chakra UI v3 Documentation
- Segun Adebayo's design philosophy

**Padrões recomendados:**
- Usar semantic tokens para cores
- Compound components para composição
- Responsive props array `[base, md, lg]`
- Acessibilidade built-in

---

## 4. Problemas Identificados

### 4.1 Código Duplicado

1. **Padrão de Dialog** (8 implementações)
   ```typescript
   // Repetido em cada dialog
   <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
     <Dialog.Backdrop />
     <Dialog.Positioner>
       <Dialog.Content>
         <Dialog.Header>
           <Dialog.Title>{title}</Dialog.Title>
         </Dialog.Header>
         <Dialog.Body>...</Dialog.Body>
         <Dialog.Footer>...</Dialog.Footer>
       </Dialog.Content>
     </Dialog.Positioner>
   </Dialog.Root>
   ```

2. **Lógica de cores PnL** (15+ arquivos)
   ```typescript
   // Repetido em cada lugar
   color={value > 0 ? 'green.500' : 'red.500'}
   ```

3. **Grid de estatísticas** (Portfolio, BacktestResults, RiskDisplay)

### 4.2 Performance Issues

1. **ChartCanvas** - 60+ hooks de indicadores causam cascata de re-renders
2. **WatcherManager** - 15+ useState, difícil otimizar
3. **Falta de memoização** em muitos componentes

### 4.3 Inconsistências

1. Dialogs com padrões diferentes de fechamento
2. Formulários sem validação padronizada
3. Estados vazios implementados inline
4. Loading states inconsistentes

---

## 5. Melhorias Propostas

### 5.1 Alta Prioridade

#### 5.1.1 Criar Componentes Base

```typescript
// ui/FormDialog.tsx
interface FormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
  isLoading?: boolean;
}

// ui/PnLDisplay.tsx
interface PnLDisplayProps {
  value: number;
  format?: 'currency' | 'percent' | 'both';
  currency?: string;
  size?: 'sm' | 'md' | 'lg';
  showSign?: boolean;
}

// ui/EmptyState.tsx
interface EmptyStateProps {
  icon?: React.ComponentType;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

// ui/MetricCard.tsx
interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  format?: 'currency' | 'percent' | 'number';
}

// ui/ConfirmationDialog.tsx
interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  colorScheme?: 'red' | 'blue';
  isLoading?: boolean;
}

// ui/CollapsibleSection.tsx
interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}
```

#### 5.1.2 Decompor Componentes Grandes

**ChartCanvas (1,902 → ~400 linhas):**
```
ChartCanvas/
├── index.tsx           # Container principal
├── useChartState.ts    # Estado consolidado
├── useChartRenderers.ts # Hooks de indicadores
├── ChartOverlays.tsx   # Tooltip, navigation
├── TradingDialogs.tsx  # Dialogs de trading
└── types.ts
```

**WatcherManager (1,607 → ~300 linhas):**
```
WatcherManager/
├── index.tsx              # Container
├── QuickStartSection.tsx  # Seleção rápida
├── WatchersList.tsx       # Lista de watchers
├── FiltersSection.tsx     # Filtros
├── ConfigSections.tsx     # Configurações
└── hooks/
    └── useWatcherState.ts
```

### 5.2 Média Prioridade

1. **Extrair componentes compartilhados:**
   - `PositionCard` (usado em Portfolio, OrdersList)
   - `OrderCard` (usado em OrdersList, FuturesPositionsPanel)
   - `WalletCard` (usado em WalletManager)

2. **Criar hooks reutilizáveis:**
   - `useSortableTable` (sorting, filtering)
   - `useFormDialog` (estado de dialog com form)
   - `useDateFormatter` (formatação consistente)

3. **Implementar virtualização:**
   - OrdersList com muitos itens
   - WatcherManager lista de símbolos

### 5.3 Baixa Prioridade

1. **Adicionar Storybook** para documentação
2. **Criar testes de componentes visuais**
3. **Implementar breadcrumbs** para navegação

---

## 6. Plano de Implementação

### Fase 1: Componentes Base (1 semana)

| Task | Arquivo | Prioridade |
|------|---------|------------|
| Criar PnLDisplay | `ui/PnLDisplay.tsx` | P1 |
| Criar EmptyState | `ui/EmptyState.tsx` | P1 |
| Criar FormDialog | `ui/FormDialog.tsx` | P1 |
| Criar ConfirmationDialog | `ui/ConfirmationDialog.tsx` | P1 |
| Criar MetricCard | `ui/MetricCard.tsx` | P2 |
| Criar CollapsibleSection | `ui/CollapsibleSection.tsx` | P2 |

### Fase 2: Refatoração de Dialogs (1 semana)

| Dialog | Ação |
|--------|------|
| AddWatcherDialog | Usar FormDialog |
| CreateWalletDialog | Usar FormDialog |
| ProfileEditorDialog | Usar FormDialog + CollapsibleSection |

### Fase 3: Decomposição de Componentes (2 semanas)

| Componente | Target |
|------------|--------|
| ChartCanvas | 5 arquivos, ~400 linhas cada |
| WatcherManager | 6 arquivos, ~250 linhas cada |
| ChartTooltip | 4 arquivos por tipo |

### Fase 4: Performance (1 semana)

| Área | Ação |
|------|------|
| Memoização | Adicionar memo/useCallback/useMemo |
| Virtualização | react-window em listas |
| Code Splitting | Lazy load de componentes pesados |

---

## 7. Critérios de Validação

### 7.1 Métricas de Qualidade

- [ ] Nenhum componente com mais de 500 linhas
- [ ] Nenhum arquivo com mais de 20 imports
- [ ] 100% dos dialogs usando FormDialog ou Dialog compound
- [ ] 100% dos estados vazios usando EmptyState
- [ ] 100% dos PnL usando PnLDisplay

### 7.2 Performance

- [ ] Lighthouse Performance Score > 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] Zero re-renders desnecessários (React DevTools)

### 7.3 Acessibilidade

- [ ] WCAG 2.1 AA compliance
- [ ] Todos os formulários com labels
- [ ] Todos os botões com aria-labels
- [ ] Contraste de cores adequado

### 7.4 Testes

- [ ] Testes unitários para todos os novos componentes
- [ ] Testes de snapshot para componentes visuais
- [ ] Coverage > 80% em novos arquivos
