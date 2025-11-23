# Sistema de Notificações Nativas

## 📋 Visão Geral

O MarketMind possui um sistema completo de notificações que utiliza a API nativa do Electron para enviar notificações do sistema operacional, funcionando tanto no macOS quanto no Windows.

## ✨ Características

### Notificações do Sistema
- **macOS:** Notificações via Notification Center
- **Windows:** Notificações via Action Center
- **Níveis de urgência:** normal, critical, low
- **Modo silencioso:** Opcional para não emitir som

### Tipos de Notificações

#### Trading Simulator
Notificações automáticas quando:
1. **Ordem Executada** - Quando uma ordem pendente é preenchida
   - Título: "Order Filled" / "Ordem Executada"
   - Corpo: Tipo, símbolo, quantidade e preço
   - Urgência: Normal

2. **Ordem Fechada (Lucro)** - Quando uma posição é fechada com lucro
   - Título: "Order Closed - Profit ✓"
   - Corpo: Tipo, símbolo, quantidade e P&L
   - Urgência: Normal

3. **Ordem Fechada (Prejuízo)** - Quando uma posição é fechada com prejuízo
   - Título: "Order Closed - Loss"
   - Corpo: Tipo, símbolo, quantidade e P&L
   - Urgência: Low

4. **Ordem Cancelada** - Quando uma ordem é cancelada
   - Título: "Order Cancelled" / "Ordem Cancelada"
   - Urgência: Low

5. **Ordem Expirada** - Quando uma ordem atinge a data de expiração
   - Título: "Order Expired" / "Ordem Expirada"
   - Urgência: Low

## 🛠 Implementação Técnica

### Arquitetura

```
Main Process (Electron)
├── Notification API (electron)
└── IPC Handlers
    ├── notification:show
    └── notification:isSupported

Renderer Process (React)
├── useNotification Hook
│   ├── showNotification()
│   ├── isSupported
│   └── error
└── useOrderNotifications Hook
    ├── Toast notifications (in-app)
    └── Native notifications (OS-level)
```

### Componentes Principais

#### 1. Main Process (`src/main/index.ts`)
```typescript
// IPC Handler para mostrar notificações
ipcMain.handle('notification:show', async (_event, options) => {
  const notification = new Notification({
    title: options.title,
    body: options.body,
    silent: options.silent ?? false,
    urgency: options.urgency ?? 'normal',
  });
  notification.show();
});
```

#### 2. Preload Script (`src/main/preload.ts`)
```typescript
// API exposta para o renderer
notification: {
  show: async (options: NotificationOptions) => {
    return await ipcRenderer.invoke('notification:show', options);
  },
  isSupported: async () => {
    return await ipcRenderer.invoke('notification:isSupported');
  },
}
```

#### 3. React Hook (`src/renderer/hooks/useNotification.ts`)
```typescript
const { showNotification, isSupported, error } = useNotification();

await showNotification({
  title: 'Order Filled',
  body: 'LONG BTC (0.1) filled at $45,000',
  urgency: 'normal',
});
```

#### 4. Trading Integration (`src/renderer/hooks/useOrderNotifications.ts`)
```typescript
// Monitora mudanças de status das ordens
// Envia toast (in-app) + notificação nativa (OS)
useOrderNotifications(); // Chamado em App.tsx
```

## 🌍 Suporte Multilíngue

Todas as notificações são traduzidas automaticamente com base no idioma do app:
- **EN:** English
- **PT:** Português
- **ES:** Español
- **FR:** Français

### Chaves de Tradução
```json
{
  "trading": {
    "notifications": {
      "orderFilled": {
        "title": "Order Filled",
        "body": "{{type}} order for {{quantity}} {{symbol}} filled at ${{price}}"
      },
      "orderClosed": {
        "titleProfit": "Order Closed - Profit ✓",
        "titleLoss": "Order Closed - Loss",
        "body": "{{type}} {{symbol}} ({{quantity}}) closed: {{pnl}}"
      }
    },
    "order": {
      "long": "LONG",
      "short": "SHORT"
    }
  }
}
```

## 📱 Uso

### Notificações Automáticas (Trading)
As notificações de trading são enviadas automaticamente quando o simulador está ativo. Não é necessário configuração adicional.

### Notificações Customizadas
```typescript
import { useNotification } from '@renderer/hooks/useNotification';

function MyComponent() {
  const { showNotification, isSupported } = useNotification();

  const handleClick = async () => {
    if (!isSupported) {
      console.warn('Notifications not supported');
      return;
    }

    await showNotification({
      title: 'Custom Notification',
      body: 'This is a custom message',
      urgency: 'normal',
      silent: false,
    });
  };

  return <button onClick={handleClick}>Notify</button>;
}
```

## 🔧 Configuração

### Permissões do Sistema

#### macOS
- As notificações funcionam automaticamente
- O usuário pode gerenciar permissões em: **System Preferences > Notifications > MarketMind**

#### Windows
- As notificações funcionam automaticamente
- O usuário pode gerenciar permissões em: **Settings > System > Notifications > MarketMind**

### Detecção de Suporte
```typescript
const { isSupported } = useNotification();

if (isSupported) {
  // Mostrar opções de notificação
} else {
  // Fallback para toasts in-app apenas
}
```

## 🎯 Níveis de Urgência

- **`normal`** - Notificações padrão (ordens executadas, lucro)
- **`low`** - Informações menos importantes (ordens canceladas/expiradas, prejuízo)
- **`critical`** - Eventos críticos (ainda não implementado no trading)

## 📝 Notas

1. **Toast + Native:** O sistema envia tanto toasts in-app quanto notificações nativas para garantir que o usuário sempre veja as atualizações
2. **Não-Intrusivo:** Notificações de prejuízo usam urgência "low" para não serem muito intrusivas
3. **Desempenho:** As notificações são assíncronas e não bloqueiam a UI
4. **Privacidade:** Todas as notificações são locais, nenhum dado é enviado para servidores externos

## 🔮 Melhorias Futuras

- [ ] Configuração de preferências de notificação por tipo
- [ ] Sons customizados por tipo de evento
- [ ] Notificações com ações (ex: "Ver Ordem", "Fechar Posição")
- [ ] Histórico de notificações
- [ ] Notificações para eventos de calendário
- [ ] Notificações para notícias importantes
- [ ] Badge count no ícone do app (macOS/Windows)

## 📚 Referências

- [Electron Notification API](https://www.electronjs.org/docs/latest/api/notification)
- [macOS Notification Center](https://support.apple.com/guide/mac-help/mh40583/mac)
- [Windows Action Center](https://support.microsoft.com/en-us/windows/change-notification-settings-in-windows-8942c744-6198-fe56-4639-34320cf9444e)
