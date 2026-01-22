# Plano de Melhoria: Infraestrutura de Testes

## 1. Estado Atual

### 1.1 Métricas de Testes

| Métrica | Valor |
|---------|-------|
| Total de Testes | 885 |
| Arquivos de Teste | 49 |
| Taxa de Sucesso | 100% |
| Cobertura | 92.15% |

### 1.2 Distribuição de Testes

| Categoria | Quantidade | Localização |
|-----------|------------|-------------|
| Indicadores | 200+ | packages/indicators/ |
| Setup Detectors | 44 | services/setup-detection/ |
| Utils | 100+ | utils/__tests__/ |
| Backend Routers | 50+ | apps/backend/__tests__/routers/ |
| Integration | 30+ | apps/backend/__tests__/ |

### 1.3 Ferramentas de Teste

| Ferramenta | Propósito |
|------------|-----------|
| Vitest | Test runner |
| @testing-library/react | Component testing |
| testcontainers | Database integration |
| MSW | API mocking (quando necessário) |

### 1.4 Infraestrutura de Testes Backend

```
apps/backend/src/__tests__/
├── helpers/
│   ├── test-db.ts           # PostgreSQL + TimescaleDB container
│   ├── test-context.ts      # tRPC context factory
│   ├── test-fixtures.ts     # Data factories
│   └── test-caller.ts       # tRPC caller
└── routers/
    ├── auth.router.test.ts
    ├── wallet.router.test.ts
    ├── trading-profiles.router.test.ts
    └── ...
```

---

## 2. Análise Acadêmica

### 2.1 Testing Pyramid

**Referências:**
- "The Practical Test Pyramid" (Martin Fowler)
- "Growing Object-Oriented Software, Guided by Tests" (Freeman & Pryce)
- "Test Driven Development" (Kent Beck)

**Pirâmide Recomendada:**
```
        /\
       /  \     E2E (5%)
      /----\
     /      \   Integration (15%)
    /--------\
   /          \ Unit (80%)
  /__________\
```

**Proporção Atual MarketMind:**
- Unit: ~70%
- Integration: ~25%
- E2E: ~5% (manual)

### 2.2 Test-Driven Development (TDD)

**Referências:**
- "Test Driven Development: By Example" (Kent Beck, 2002)
- "The Art of Unit Testing" (Roy Osherove, 2013)

**Ciclo TDD:**
```
1. Red: Escrever teste que falha
2. Green: Implementar código mínimo para passar
3. Refactor: Melhorar código mantendo testes verdes
```

**Benefícios:**
- Design emergente
- Documentação executável
- Confiança para refatorar

### 2.3 Property-Based Testing

**Referências:**
- "QuickCheck: A Lightweight Tool for Random Testing" (Claessen & Hughes)
- fast-check library (JavaScript)

**Conceito:**
```typescript
// Em vez de testar valores específicos
test('add(1, 2) = 3', () => {
  expect(add(1, 2)).toBe(3);
});

// Testar propriedades para qualquer input
test('add is commutative', () => {
  fc.assert(fc.property(fc.integer(), fc.integer(), (a, b) => {
    return add(a, b) === add(b, a);
  }));
});
```

**Aplicações em Trading:**
- Indicadores devem retornar valores no range esperado
- Position sizing nunca pode exceder capital
- Stop loss sempre menor que entry (para long)

### 2.4 Mutation Testing

**Referências:**
- "An Introduction to Mutation Testing" (Jia & Harman)
- Stryker Mutator (JavaScript)

**Conceito:**
```
1. Introduz "mutantes" no código (modificações)
2. Executa testes
3. Mutantes mortos = testes efetivos
4. Mutantes vivos = gaps na cobertura
```

**Mutações comuns:**
- `>` para `>=`
- `&&` para `||`
- `+` para `-`
- `true` para `false`

### 2.5 Visual Regression Testing

**Referências:**
- Chromatic (Storybook)
- Percy
- Playwright Visual Comparisons

**Aplicação:**
- Detectar mudanças não intencionais em UI
- Validar charts renderizam corretamente
- Consistência entre temas

---

## 3. Benchmarking de Mercado

### 3.1 TradingView

- Testes unitários extensivos
- Visual regression para charts
- Performance benchmarks
- Cross-browser testing

### 3.2 Bloomberg Terminal

- Testes de financial accuracy
- Compliance testing
- Performance sob carga
- Disaster recovery tests

### 3.3 Stripe

**Referência:** "Testing at Stripe" (Stripe Engineering Blog)

- Property-based testing extensivo
- Contract testing entre serviços
- Chaos engineering
- Mutation testing

---

## 4. Problemas Identificados

### 4.1 Gaps de Cobertura

| Área | Cobertura | Target |
|------|-----------|--------|
| Chart renderers | ~60% | 90% |
| Auto-trading | ~75% | 95% |
| UI Components | ~50% | 80% |
| Edge cases | ~40% | 90% |

### 4.2 Testes Ausentes

1. **Performance tests** - Não existem benchmarks automatizados
2. **Visual regression** - Charts não são testados visualmente
3. **E2E tests** - Apenas manuais
4. **Load tests** - Sem testes de carga
5. **Cross-browser** - Apenas local testing

### 4.3 Testes Frágeis

1. **Timing dependent** - Alguns testes dependem de delays
2. **Order dependent** - Alguns testes falham se ordem muda
3. **Flaky containers** - testcontainers ocasionalmente timeout

### 4.4 Falta de Property-Based Testing

```typescript
// Atual: Valores específicos
test('RSI should be in range', () => {
  const result = calculateRSI([100, 110, 105], 14);
  expect(result[0]).toBeGreaterThanOrEqual(0);
  expect(result[0]).toBeLessThanOrEqual(100);
});

// Falta: Qualquer input
test('RSI should always be 0-100', () => {
  fc.assert(fc.property(fc.array(fc.float({ min: 0.01 })), (prices) => {
    const result = calculateRSI(prices, 14);
    return result.every(v => isNaN(v) || (v >= 0 && v <= 100));
  }));
});
```

---

## 5. Melhorias Propostas

### 5.1 Property-Based Testing para Indicadores

```typescript
// packages/indicators/src/__tests__/properties.test.ts
import * as fc from 'fast-check';

describe('Indicator Properties', () => {
  describe('RSI', () => {
    it('should always return values between 0 and 100', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: 0.01, max: 1000000 }), { minLength: 20 }),
          (prices) => {
            const result = calculateRSI(prices, 14);
            return result.every(v => isNaN(v) || (v >= 0 && v <= 100));
          }
        )
      );
    });

    it('should return 100 for continuously rising prices', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 20, max: 100 }),
          (length) => {
            const prices = Array.from({ length }, (_, i) => 100 + i);
            const result = calculateRSI(prices, 14);
            const lastValue = result[result.length - 1];
            return lastValue > 90; // Close to 100
          }
        )
      );
    });
  });

  describe('Position Sizing', () => {
    it('should never exceed account balance', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1000, max: 1000000 }),
          fc.float({ min: 0.01, max: 0.1 }),
          fc.float({ min: 1, max: 10000 }),
          fc.float({ min: 0.01, max: 0.05 }),
          (account, riskPercent, entryPrice, stopPercent) => {
            const stopPrice = entryPrice * (1 - stopPercent);
            const size = calculatePositionSize({
              account,
              riskPercent,
              entryPrice,
              stopPrice,
            });
            return size * entryPrice <= account;
          }
        )
      );
    });
  });
});
```

### 5.2 Visual Regression Testing

```typescript
// apps/electron/src/__tests__/visual/chart.test.ts
import { test, expect } from '@playwright/test';

test.describe('Chart Visual Regression', () => {
  test('candlestick chart renders correctly', async ({ page }) => {
    await page.goto('/chart?symbol=BTCUSDT&interval=1h');
    await page.waitForSelector('[data-testid="chart-canvas"]');

    await expect(page).toHaveScreenshot('candlestick-chart.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('dark mode renders correctly', async ({ page }) => {
    await page.goto('/chart?symbol=BTCUSDT&interval=1h&theme=dark');
    await page.waitForSelector('[data-testid="chart-canvas"]');

    await expect(page).toHaveScreenshot('chart-dark-mode.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('indicators render correctly', async ({ page }) => {
    await page.goto('/chart?symbol=BTCUSDT&interval=1h&indicators=RSI,MACD');

    await expect(page).toHaveScreenshot('chart-with-indicators.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});
```

### 5.3 Performance Benchmarks

```typescript
// packages/indicators/src/__tests__/benchmarks.test.ts
import { bench, describe } from 'vitest';

describe('Indicator Performance', () => {
  const prices = generateRandomPrices(10000);

  bench('RSI calculation (10k candles)', () => {
    calculateRSI(prices, 14);
  });

  bench('MACD calculation (10k candles)', () => {
    calculateMACD(prices, 12, 26, 9);
  });

  bench('Bollinger Bands (10k candles)', () => {
    calculateBollingerBands(prices, 20, 2);
  });

  bench('All indicators combined', () => {
    calculateRSI(prices, 14);
    calculateMACD(prices, 12, 26, 9);
    calculateBollingerBands(prices, 20, 2);
    calculateStochastic(prices, 14, 3);
  });
});
```

### 5.4 E2E Tests com Playwright

```typescript
// apps/electron/e2e/trading-flow.test.ts
import { test, expect, ElectronApplication, _electron } from '@playwright/test';

let electronApp: ElectronApplication;

test.beforeAll(async () => {
  electronApp = await _electron.launch({
    args: ['.'],
    env: { NODE_ENV: 'test' },
  });
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe('Trading Flow', () => {
  test('user can create a paper wallet', async () => {
    const window = await electronApp.firstWindow();

    await window.click('[data-testid="create-wallet-button"]');
    await window.fill('[data-testid="wallet-name-input"]', 'Test Wallet');
    await window.click('[data-testid="wallet-type-paper"]');
    await window.click('[data-testid="submit-button"]');

    await expect(window.locator('[data-testid="wallet-list"]')).toContainText('Test Wallet');
  });

  test('user can place a paper trade', async () => {
    const window = await electronApp.firstWindow();

    await window.click('[data-testid="trade-button"]');
    await window.fill('[data-testid="quantity-input"]', '0.1');
    await window.click('[data-testid="buy-button"]');

    await expect(window.locator('[data-testid="order-success"]')).toBeVisible();
  });
});
```

### 5.5 Contract Testing

```typescript
// apps/backend/src/__tests__/contracts/wallet-api.contract.test.ts
import { Pact } from '@pact-foundation/pact';

describe('Wallet API Contract', () => {
  const provider = new Pact({
    consumer: 'MarketMind Frontend',
    provider: 'MarketMind Backend',
  });

  beforeAll(() => provider.setup());
  afterAll(() => provider.finalize());

  describe('list wallets', () => {
    beforeAll(() => {
      return provider.addInteraction({
        state: 'user has wallets',
        uponReceiving: 'a request for wallets',
        withRequest: {
          method: 'GET',
          path: '/trpc/wallet.list',
        },
        willRespondWith: {
          status: 200,
          body: {
            result: {
              data: Matchers.eachLike({
                id: Matchers.integer(),
                name: Matchers.string(),
                exchange: Matchers.string(),
              }),
            },
          },
        },
      });
    });

    it('returns wallet list', async () => {
      const response = await trpc.wallet.list.query();
      expect(response).toBeDefined();
      expect(Array.isArray(response)).toBe(true);
    });
  });
});
```

### 5.6 Mutation Testing Setup

```javascript
// stryker.conf.mjs
export default {
  mutator: 'typescript',
  packageManager: 'pnpm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  mutate: [
    'packages/indicators/src/**/*.ts',
    '!packages/indicators/src/**/*.test.ts',
  ],
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
};
```

---

## 6. Plano de Implementação

### Fase 1: Property-Based Testing (1 semana)

| Task | Prioridade |
|------|------------|
| Instalar fast-check | P1 |
| Testes de propriedade para indicadores | P1 |
| Testes de propriedade para position sizing | P1 |
| Testes de propriedade para PnL calculation | P2 |

### Fase 2: Performance Benchmarks (3 dias)

| Task | Prioridade |
|------|------------|
| Configurar vitest bench | P2 |
| Benchmarks para indicadores | P2 |
| Benchmarks para renderers | P3 |
| CI integration | P2 |

### Fase 3: Visual Regression (1 semana)

| Task | Prioridade |
|------|------------|
| Configurar Playwright | P2 |
| Screenshot tests para charts | P2 |
| Theme switching tests | P2 |
| CI integration | P2 |

### Fase 4: E2E Tests (1 semana)

| Task | Prioridade |
|------|------------|
| Configurar Playwright Electron | P2 |
| Critical path tests | P1 |
| Trading flow tests | P2 |
| Wallet management tests | P2 |

### Fase 5: Advanced Testing (2 semanas)

| Task | Prioridade |
|------|------------|
| Contract testing setup | P3 |
| Mutation testing setup | P3 |
| Load testing | P3 |
| Chaos testing | P3 |

---

## 7. Critérios de Validação

### 7.1 Cobertura

- [ ] Overall coverage > 90%
- [ ] Chart renderers > 80%
- [ ] UI components > 80%
- [ ] Critical paths 100%

### 7.2 Qualidade

- [ ] Zero testes flaky
- [ ] Mutation score > 70%
- [ ] Todas propriedades testadas
- [ ] Visual regression baseline

### 7.3 Performance

- [ ] Benchmarks automatizados
- [ ] Regression alerts
- [ ] Historical tracking
- [ ] CI integration

### 7.4 CI/CD

- [ ] All tests in CI
- [ ] < 10 min total runtime
- [ ] Parallel execution
- [ ] Failure notifications

---

## 8. Arquivos a Criar/Modificar

### Criar

1. `packages/indicators/src/__tests__/properties.test.ts`
2. `packages/indicators/src/__tests__/benchmarks.test.ts`
3. `apps/electron/e2e/` - E2E test directory
4. `apps/electron/e2e/playwright.config.ts`
5. `stryker.conf.mjs`
6. `.github/workflows/tests.yml` - Atualizar

### Configurar

1. `vitest.config.ts` - Adicionar bench
2. `package.json` - Scripts de teste
3. CI pipeline - Adicionar novos testes
