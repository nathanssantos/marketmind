# WebSocket Real-Time Setup Notifications

Exemplo completo de como usar notificações de setups em tempo real via WebSocket.

## Componente com WebSocket Real-Time

```typescript
import { useEffect, useState } from 'react';
import { useBackendSetups } from '../hooks/useBackendSetups';
import { useAuthStore } from '../store/authStore';
import { useSymbolStore } from '../store/symbolStore';
import type { TradingSetup } from '@marketmind/types';

export const RealtimeSetupMonitor = () => {
  const { user } = useAuthStore();
  const { symbol, interval } = useSymbolStore();
  const {
    useDetectCurrent,
    useRealtimeSetups,
  } = useBackendSetups();

  const [notifications, setNotifications] = useState<TradingSetup[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Query inicial para setups atuais
  const { data: current, isLoading } = useDetectCurrent({ symbol, interval });

  // Habilitar notificações em tempo real via WebSocket
  useRealtimeSetups(user?.id || '', !!user);

  // Detectar novos setups e mostrar notificação
  useEffect(() => {
    if (!current?.setups.length) return;

    const newSetups = current.setups.filter(
      (setup) =>
        !notifications.find((n) => n.id === setup.id) &&
        new Date(setup.detectedAt).getTime() > Date.now() - 5000 // Últimos 5 segundos
    );

    if (newSetups.length > 0) {
      setNotifications((prev) => [...newSetups, ...prev].slice(0, 10));

      // Notificação do sistema
      newSetups.forEach((setup) => {
        if (Notification.permission === 'granted') {
          new Notification('Novo Setup Detectado! 🎯', {
            body: `${setup.type} ${setup.direction} - ${symbol}\nConfiança: ${setup.confidence}% | R/R: ${setup.riskRewardRatio.toFixed(2)}`,
            icon: '/icon.png',
            tag: setup.id,
          });
        }

        // Áudio de alerta
        if (audioEnabled) {
          const audio = new Audio('/sounds/notification.mp3');
          audio.play().catch(() => {});
        }
      });
    }
  }, [current, notifications, audioEnabled, symbol]);

  // Solicitar permissão para notificações
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="realtime-monitor">
      <div className="header">
        <h2>Monitor em Tempo Real</h2>
        <div className="controls">
          <label>
            <input
              type="checkbox"
              checked={audioEnabled}
              onChange={(e) => setAudioEnabled(e.target.checked)}
            />
            Áudio
          </label>
        </div>
      </div>

      <div className="current-setups">
        <h3>Setups Atuais ({symbol})</h3>
        {isLoading && <p>Detectando...</p>}
        {current?.setups.length === 0 && <p>Nenhum setup detectado</p>}
        {current?.setups.map((setup) => (
          <SetupCard key={setup.id} setup={setup} isNew={false} />
        ))}
      </div>

      <div className="notifications">
        <h3>Notificações Recentes</h3>
        {notifications.map((setup) => (
          <SetupCard key={setup.id} setup={setup} isNew={true} />
        ))}
      </div>
    </div>
  );
};
```

## Componente de Setup Card

```typescript
interface SetupCardProps {
  setup: TradingSetup;
  isNew: boolean;
}

const SetupCard = ({ setup, isNew }: SetupCardProps) => {
  const getBadgeColor = (confidence: number) => {
    if (confidence >= 80) return 'green';
    if (confidence >= 60) return 'yellow';
    return 'orange';
  };

  return (
    <div className={`setup-card ${isNew ? 'new-setup' : ''}`}>
      <div className="setup-header">
        <span className="setup-type">{setup.type}</span>
        <span className={`direction ${setup.direction.toLowerCase()}`}>
          {setup.direction}
        </span>
        {isNew && <span className="badge new">NOVO</span>}
      </div>

      <div className="setup-prices">
        <div>
          <label>Entry:</label>
          <span className="price">${setup.entryPrice}</span>
        </div>
        <div>
          <label>Stop:</label>
          <span className="price stop">${setup.stopLoss}</span>
        </div>
        <div>
          <label>Target:</label>
          <span className="price target">${setup.takeProfit}</span>
        </div>
      </div>

      <div className="setup-metrics">
        <div>
          <label>Confiança:</label>
          <span className={`badge ${getBadgeColor(setup.confidence)}`}>
            {setup.confidence}%
          </span>
        </div>
        <div>
          <label>R/R:</label>
          <span className="metric">{setup.riskRewardRatio.toFixed(2)}</span>
        </div>
      </div>

      <div className="setup-time">
        Detectado: {new Date(setup.detectedAt).toLocaleTimeString()}
      </div>
    </div>
  );
};
```

## CSS para Animação de Novo Setup

```css
.setup-card {
  padding: 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 12px;
  background: white;
  transition: all 0.3s ease;
}

.setup-card.new-setup {
  animation: pulse 2s ease-in-out;
  border-color: #4caf50;
  box-shadow: 0 0 20px rgba(76, 175, 80, 0.3);
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 20px rgba(76, 175, 80, 0.3);
  }
  50% {
    transform: scale(1.02);
    box-shadow: 0 0 30px rgba(76, 175, 80, 0.5);
  }
}

.badge.new {
  background: #4caf50;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
  animation: blink 1.5s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.direction.long {
  color: #4caf50;
  font-weight: bold;
}

.direction.short {
  color: #f44336;
  font-weight: bold;
}

.badge.green { background: #4caf50; color: white; }
.badge.yellow { background: #ff9800; color: white; }
.badge.orange { background: #ff5722; color: white; }
```

## Hook Personalizado para Notificações

```typescript
import { useEffect, useState } from 'react';
import { useBackendSetups } from './useBackendSetups';
import type { TradingSetup } from '@marketmind/types';

interface UseSetupNotificationsOptions {
  userId: string;
  symbol: string;
  interval: string;
  enabled?: boolean;
  audioEnabled?: boolean;
  systemNotifications?: boolean;
}

export const useSetupNotifications = ({
  userId,
  symbol,
  interval,
  enabled = true,
  audioEnabled = true,
  systemNotifications = true,
}: UseSetupNotificationsOptions) => {
  const { useDetectCurrent, useRealtimeSetups } = useBackendSetups();
  const [lastSeenSetups, setLastSeenSetups] = useState<Set<string>>(new Set());

  // Conectar ao WebSocket
  useRealtimeSetups(userId, enabled);

  // Monitorar setups atuais
  const { data: current } = useDetectCurrent({ symbol, interval });

  useEffect(() => {
    if (!current?.setups.length || !enabled) return;

    const newSetups = current.setups.filter(
      (setup) => !lastSeenSetups.has(setup.id)
    );

    if (newSetups.length > 0) {
      // Atualizar lista de setups vistos
      setLastSeenSetups(
        (prev) => new Set([...prev, ...newSetups.map((s) => s.id)])
      );

      // Notificações do sistema
      if (systemNotifications && Notification.permission === 'granted') {
        newSetups.forEach((setup) => {
          new Notification('Novo Setup Detectado! 🎯', {
            body: `${setup.type} ${setup.direction}\nConfiança: ${setup.confidence}%`,
            tag: setup.id,
          });
        });
      }

      // Áudio
      if (audioEnabled) {
        const audio = new Audio('/sounds/notification.mp3');
        audio.play().catch(console.error);
      }

      // Callback customizado (opcional)
      newSetups.forEach((setup) => {
        console.log('Novo setup:', setup);
      });
    }
  }, [
    current,
    enabled,
    systemNotifications,
    audioEnabled,
    lastSeenSetups,
  ]);

  return {
    newSetupsCount: lastSeenSetups.size,
    clearNotifications: () => setLastSeenSetups(new Set()),
  };
};
```

## Uso do Hook de Notificações

```typescript
const TradingDashboard = () => {
  const { user } = useAuthStore();
  const { symbol, interval } = useSymbolStore();

  const { newSetupsCount, clearNotifications } = useSetupNotifications({
    userId: user?.id || '',
    symbol,
    interval,
    enabled: true,
    audioEnabled: true,
    systemNotifications: true,
  });

  return (
    <div>
      <h1>Dashboard</h1>
      {newSetupsCount > 0 && (
        <div className="notification-badge">
          {newSetupsCount} novos setups
          <button onClick={clearNotifications}>Limpar</button>
        </div>
      )}
      {/* Resto do dashboard */}
    </div>
  );
};
```

## WebSocket Multi-Symbol Monitor

```typescript
import { useState } from 'react';
import { useBackendSetups } from '../hooks/useBackendSetups';

export const MultiSymbolMonitor = () => {
  const { useRealtimeSetups } = useBackendSetups();
  const { user } = useAuthStore();
  
  const [symbols] = useState(['BTCUSDT', 'ETHUSDT', 'BNBUSDT']);
  const [interval] = useState('1h');

  // Conectar ao WebSocket uma vez
  useRealtimeSetups(user?.id || '', !!user);

  return (
    <div className="multi-monitor">
      {symbols.map((symbol) => (
        <SymbolPanel
          key={symbol}
          symbol={symbol}
          interval={interval}
        />
      ))}
    </div>
  );
};

const SymbolPanel = ({ symbol, interval }: { symbol: string; interval: string }) => {
  const { useDetectCurrent } = useBackendSetups();
  const { data } = useDetectCurrent({ symbol, interval });

  return (
    <div className="symbol-panel">
      <h3>{symbol}</h3>
      <p>Setups: {data?.setups.length || 0}</p>
      {data?.setups.map((setup) => (
        <div key={setup.id} className="mini-setup-card">
          {setup.type} {setup.direction} - {setup.confidence}%
        </div>
      ))}
    </div>
  );
};
```

## Benefícios do WebSocket

✅ **Atualizações Instantâneas**: Setups detectados aparecem imediatamente, sem polling
✅ **Performance**: Reduz carga no servidor (60x menos requisições vs polling 60s)
✅ **Experiência do Usuário**: Notificações em tempo real para não perder oportunidades
✅ **Eficiência**: Invalida cache automaticamente quando novos setups são detectados
✅ **Escalável**: Suporta múltiplos símbolos e intervalos simultaneamente

## Fluxo Completo

1. **Backend**: Detecta setup no endpoint `detectCurrent`
2. **Backend**: Salva no database (cache 24h)
3. **Backend**: Emite evento WebSocket para `user:{userId}`
4. **Frontend**: Recebe evento via `useRealtimeSetups`
5. **Frontend**: Invalida cache do React Query
6. **Frontend**: Re-fetch automático dos dados
7. **Frontend**: Notificação visual + sonora ao usuário
8. **Frontend**: Atualização instantânea da UI

## Próximos Passos

- [ ] Adicionar filtros de notificação (apenas setups específicos)
- [ ] Implementar histórico de notificações
- [ ] Adicionar sons customizados por tipo de setup
- [ ] Criar configuração de preferências de notificação
- [ ] Implementar rate limiting para evitar spam
