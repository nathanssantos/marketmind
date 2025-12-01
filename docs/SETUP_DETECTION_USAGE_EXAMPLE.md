# Setup Detection Usage Example

Exemplo prático de como usar o hook `useBackendSetups` em componentes React.

## Exemplo Completo: Componente de Detecção

```typescript
import { useBackendSetups } from '../hooks/useBackendSetups';
import { useSymbolStore } from '../store/symbolStore';
import type { TradingSetup } from '@marketmind/types';

export const SetupDetectionPanel = () => {
  const { symbol, interval } = useSymbolStore();
  const {
    useDetectCurrent,
    useHistory,
    useStats,
    useConfig,
    updateConfig,
  } = useBackendSetups();

  // Detecção em tempo real (auto-refetch a cada 60s)
  const { data: current, isLoading } = useDetectCurrent({
    symbol,
    interval,
  });

  // Histórico com filtros
  const { data: history } = useHistory({
    symbol,
    setupType: 'setup91', // Opcional: filtrar por tipo
    direction: 'LONG',    // Opcional: filtrar por direção
    limit: 20,
  });

  // Estatísticas
  const { data: stats } = useStats({ symbol });

  // Configuração
  const { data: config } = useConfig();

  const handleToggleSetup = async (setupType: string, enabled: boolean) => {
    await updateConfig.mutateAsync({
      [setupType]: { ...config?.[setupType], enabled },
    });
  };

  return (
    <div>
      {/* Detecções Atuais */}
      <section>
        <h2>Setups Detectados Agora</h2>
        {isLoading && <p>Detectando...</p>}
        {current?.setups.map((setup) => (
          <SetupCard key={setup.id} setup={setup} />
        ))}
      </section>

      {/* Histórico */}
      <section>
        <h2>Histórico (últimos 20)</h2>
        {history?.setups.map((setup) => (
          <HistoryCard key={setup.id} setup={setup} />
        ))}
        <p>Total: {history?.total}</p>
      </section>

      {/* Estatísticas */}
      <section>
        <h2>Estatísticas</h2>
        <p>Total: {stats?.totalSetups}</p>
        <p>LONG: {stats?.byDirection.LONG}</p>
        <p>SHORT: {stats?.byDirection.SHORT}</p>
        <p>Confiança Média: {stats?.avgConfidence}%</p>
        <p>Risk/Reward Médio: {stats?.avgRiskReward}</p>
      </section>

      {/* Configuração */}
      <section>
        <h2>Configuração</h2>
        {Object.entries(config || {}).map(([key, value]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={value?.enabled}
              onChange={(e) => handleToggleSetup(key, e.target.checked)}
            />
            {key}
          </label>
        ))}
      </section>
    </div>
  );
};
```

## Exemplo: Card de Setup

```typescript
interface SetupCardProps {
  setup: TradingSetup;
}

const SetupCard = ({ setup }: SetupCardProps) => {
  return (
    <div className="setup-card">
      <div className="setup-header">
        <span className="setup-type">{setup.setupType}</span>
        <span className={`direction ${setup.direction.toLowerCase()}`}>
          {setup.direction}
        </span>
      </div>
      
      <div className="setup-prices">
        <div>
          <label>Entry:</label>
          <span>${setup.entryPrice}</span>
        </div>
        <div>
          <label>Stop:</label>
          <span>${setup.stopLoss}</span>
        </div>
        <div>
          <label>Target:</label>
          <span>${setup.takeProfit}</span>
        </div>
      </div>

      <div className="setup-metrics">
        <div>
          <label>Confiança:</label>
          <span>{setup.confidence}%</span>
        </div>
        <div>
          <label>R/R:</label>
          <span>{setup.riskRewardRatio.toFixed(2)}</span>
        </div>
      </div>

      {setup.setupData && (
        <div className="setup-data">
          <pre>{JSON.stringify(setup.setupData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
```

## Exemplo: Detecção por Range

```typescript
const HistoricalAnalysis = () => {
  const { symbol, interval } = useSymbolStore();
  const { useDetectRange } = useBackendSetups();
  const [dateRange, setDateRange] = useState({
    start: new Date('2024-01-01'),
    end: new Date('2024-01-31'),
  });

  const { data, isLoading } = useDetectRange(
    symbol,
    interval,
    dateRange.start,
    dateRange.end
  );

  return (
    <div>
      <h2>Análise Histórica</h2>
      
      <DateRangePicker
        start={dateRange.start}
        end={dateRange.end}
        onChange={setDateRange}
      />

      {isLoading && <p>Analisando...</p>}
      
      <div>
        <p>Setups encontrados: {data?.setups.length}</p>
        {data?.setups.map((setup) => (
          <SetupCard key={setup.id} setup={setup} />
        ))}
      </div>
    </div>
  );
};
```

## Exemplo: Notificações em Tempo Real

```typescript
const SetupNotifications = () => {
  const { symbol, interval } = useSymbolStore();
  const { useDetectCurrent } = useBackendSetups();
  const [notifications, setNotifications] = useState<TradingSetup[]>([]);

  const { data: current } = useDetectCurrent({ symbol, interval });

  useEffect(() => {
    if (current?.setups.length) {
      // Adicionar novos setups às notificações
      const newSetups = current.setups.filter(
        (setup) => !notifications.find((n) => n.id === setup.id)
      );
      
      if (newSetups.length > 0) {
        setNotifications((prev) => [...newSetups, ...prev].slice(0, 10));
        
        // Mostrar notificação do sistema
        newSetups.forEach((setup) => {
          new Notification('Novo Setup Detectado!', {
            body: `${setup.setupType} ${setup.direction} - Confiança: ${setup.confidence}%`,
          });
        });
      }
    }
  }, [current]);

  return (
    <div className="notifications">
      <h3>Notificações</h3>
      {notifications.map((setup) => (
        <NotificationItem key={setup.id} setup={setup} />
      ))}
    </div>
  );
};
```

## Exemplo: Filtros Avançados

```typescript
const SetupHistory = () => {
  const { symbol } = useSymbolStore();
  const { useHistory } = useBackendSetups();
  
  const [filters, setFilters] = useState({
    setupType: undefined as string | undefined,
    direction: undefined as 'LONG' | 'SHORT' | undefined,
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 dias
    endDate: new Date(),
    limit: 50,
  });

  const { data, isLoading } = useHistory({
    symbol,
    ...filters,
  });

  return (
    <div>
      <div className="filters">
        <select
          value={filters.setupType || ''}
          onChange={(e) => setFilters({ ...filters, setupType: e.target.value || undefined })}
        >
          <option value="">Todos os setups</option>
          <option value="setup91">Setup 9.1</option>
          <option value="setup92">Setup 9.2</option>
          <option value="setup93">Setup 9.3</option>
          <option value="setup94">Setup 9.4</option>
          <option value="pattern123">Pattern 1-2-3</option>
          {/* ... outros setups */}
        </select>

        <select
          value={filters.direction || ''}
          onChange={(e) => setFilters({ ...filters, direction: e.target.value as any || undefined })}
        >
          <option value="">Todas as direções</option>
          <option value="LONG">LONG</option>
          <option value="SHORT">SHORT</option>
        </select>

        <input
          type="date"
          value={filters.startDate.toISOString().split('T')[0]}
          onChange={(e) => setFilters({ ...filters, startDate: new Date(e.target.value) })}
        />

        <input
          type="date"
          value={filters.endDate.toISOString().split('T')[0]}
          onChange={(e) => setFilters({ ...filters, endDate: new Date(e.target.value) })}
        />
      </div>

      {isLoading && <p>Carregando...</p>}
      
      <div className="results">
        <p>Encontrados: {data?.total} setups</p>
        {data?.setups.map((setup) => (
          <SetupCard key={setup.id} setup={setup} />
        ))}
      </div>
    </div>
  );
};
```

## Exemplo: Dashboard de Estatísticas

```typescript
const SetupDashboard = () => {
  const { symbol } = useSymbolStore();
  const { useStats } = useBackendSetups();
  
  const [period, setPeriod] = useState('7d');
  
  const startDate = useMemo(() => {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }, [period]);

  const { data: stats } = useStats({
    symbol,
    startDate,
  });

  return (
    <div className="dashboard">
      <h2>Dashboard de Setups</h2>
      
      <select value={period} onChange={(e) => setPeriod(e.target.value)}>
        <option value="7d">Últimos 7 dias</option>
        <option value="30d">Últimos 30 dias</option>
        <option value="90d">Últimos 90 dias</option>
      </select>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total</h3>
          <p className="stat-value">{stats?.totalSetups || 0}</p>
        </div>

        <div className="stat-card">
          <h3>LONG</h3>
          <p className="stat-value">{stats?.byDirection.LONG || 0}</p>
        </div>

        <div className="stat-card">
          <h3>SHORT</h3>
          <p className="stat-value">{stats?.byDirection.SHORT || 0}</p>
        </div>

        <div className="stat-card">
          <h3>Confiança Média</h3>
          <p className="stat-value">{stats?.avgConfidence.toFixed(1)}%</p>
        </div>

        <div className="stat-card">
          <h3>R/R Médio</h3>
          <p className="stat-value">{stats?.avgRiskReward.toFixed(2)}</p>
        </div>
      </div>

      <div className="setup-breakdown">
        <h3>Por Tipo de Setup</h3>
        {Object.entries(stats?.byType || {}).map(([type, count]) => (
          <div key={type} className="type-row">
            <span>{type}</span>
            <span>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Exemplo: Configuração de Setups

```typescript
const SetupConfiguration = () => {
  const { useConfig, updateConfig } = useBackendSetups();
  const { data: config, isLoading } = useConfig();

  const handleUpdateSetup = async (setupType: string, updates: any) => {
    await updateConfig.mutateAsync({
      [setupType]: {
        ...config?.[setupType],
        ...updates,
      },
    });
  };

  if (isLoading) return <p>Carregando configuração...</p>;

  return (
    <div className="setup-config">
      <h2>Configuração de Setups</h2>

      {/* Configurações Globais */}
      <section>
        <h3>Global</h3>
        <label>
          Confiança Mínima:
          <input
            type="number"
            value={config?.minConfidence || 70}
            onChange={(e) => updateConfig.mutateAsync({ minConfidence: Number(e.target.value) })}
          />
        </label>
        <label>
          Risk/Reward Mínimo:
          <input
            type="number"
            step="0.1"
            value={config?.minRiskReward || 2.0}
            onChange={(e) => updateConfig.mutateAsync({ minRiskReward: Number(e.target.value) })}
          />
        </label>
        <label>
          Cooldown (klines):
          <input
            type="number"
            value={config?.setupCooldownPeriod || 10}
            onChange={(e) => updateConfig.mutateAsync({ setupCooldownPeriod: Number(e.target.value) })}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={config?.trendFilterEnabled || false}
            onChange={(e) => updateConfig.mutateAsync({ trendFilterEnabled: e.target.checked })}
          />
          Filtro de Tendência (EMA 200)
        </label>
      </section>

      {/* Setup 9.1 */}
      <section>
        <h3>Setup 9.1 (Reversão)</h3>
        <label>
          <input
            type="checkbox"
            checked={config?.setup91?.enabled || false}
            onChange={(e) => handleUpdateSetup('setup91', { enabled: e.target.checked })}
          />
          Ativado
        </label>
        <label>
          Período EMA:
          <input
            type="number"
            value={config?.setup91?.emaPeriod || 9}
            onChange={(e) => handleUpdateSetup('setup91', { emaPeriod: Number(e.target.value) })}
          />
        </label>
        <label>
          Multiplicador de Volume:
          <input
            type="number"
            step="0.1"
            value={config?.setup91?.volumeMultiplier || 1.5}
            onChange={(e) => handleUpdateSetup('setup91', { volumeMultiplier: Number(e.target.value) })}
          />
        </label>
      </section>

      {/* Outros setups... */}
    </div>
  );
};
```

## Integração com WebSocket (Futuro)

```typescript
// Quando implementar WebSocket para setups em tempo real
const RealtimeSetups = () => {
  const { symbol, interval } = useSymbolStore();
  const { useDetectCurrent } = useBackendSetups();
  const { subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    // Subscrever a eventos de setup
    subscribe('setup-detected', (data) => {
      console.log('Novo setup detectado via WebSocket:', data);
      // Invalidar cache e refetch
      queryClient.invalidateQueries(['setup', 'detectCurrent']);
    });

    return () => unsubscribe('setup-detected');
  }, [subscribe, unsubscribe]);

  const { data } = useDetectCurrent({ symbol, interval });

  return <div>{/* ... */}</div>;
};
```

## Dicas de Performance

1. **Use staleTime apropriado**: O hook já configura stale times adequados, mas você pode ajustar se necessário
2. **Evite re-renders desnecessários**: Use `React.memo` nos cards de setup
3. **Paginação**: Use o parâmetro `limit` no `useHistory` para controlar quantidade de dados
4. **Filtros no servidor**: Sempre que possível, filtre no backend (useHistory) ao invés de no frontend
5. **Cache de queries**: React Query já gerencia o cache automaticamente

## Próximos Passos

- [ ] Implementar esses componentes no app
- [ ] Adicionar WebSocket para notificações em tempo real
- [ ] Criar testes para os componentes
- [ ] Adicionar persistência de filtros (localStorage)
- [ ] Implementar exports (CSV, PDF) dos setups
