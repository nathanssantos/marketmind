# Trading Simulator Mode - Implementation Plan

## Overview
Implement a comprehensive trading simulator mode that allows users to practice trading with real-time price data (and future historical replay). The simulator will support long/short positions, stop-loss/take-profit targets, and complete order management.

## Current Architecture Context

### Existing Components
- **Toolbar**: Main toolbar at top with chart controls (Toolbar.tsx)
- **ChatSidebar**: Resizable right sidebar (300-800px) with chat interface
- **MainLayout**: Manages layout with header, toolbar, chart, and chat sidebar
- **Store System**: Zustand stores (aiStore.ts, potential for tradingStore.ts)
- **Keyboard Shortcuts**: useKeyboardShortcut hook with platform-aware modifiers

### Key Constraints
- Chat sidebar is currently right-positioned
- Toolbar has 48px height at top
- MainLayout starts at 116px from top (header + toolbar)
- Chat width is controlled via localStorage
- Existing keyboard shortcuts: Cmd+K, Cmd+B, M, G, T, 1-5, +, -, 0, arrows, Space+Drag

### Development Guidelines
- **Latest Versions**: Always use the latest stable versions of all libraries
- **Official Documentation**: Consult official documentation for each library before implementation:
  - **Recharts**: https://recharts.org/en-US/api - Check latest API for chart components
  - **Zustand**: https://zustand-demo.pmnd.rs/ - Verify persist middleware and store patterns
  - **Chakra UI**: https://www.chakra-ui.com/docs - Confirm component APIs and props
  - **React i18next**: https://react.i18next.com/ - Review translation hooks and interpolation
  - **Nanoid**: https://github.com/ai/nanoid - Check latest ID generation patterns
- **Breaking Changes**: Review migration guides and changelogs when upgrading
- **TypeScript Support**: Ensure all libraries have proper TypeScript definitions
- **Bundle Size**: Prefer tree-shakeable imports when available

---

## Phase 1: Data Architecture & State Management

### 1.1 Trading Store (Zustand)
Create `/src/renderer/store/tradingStore.ts` with:

**State Structure:**
```typescript
interface Wallet {
  id: string;
  name: string;
  balance: number;
  initialBalance: number;
  currency: 'USD' | 'BRL' | 'EUR';
  createdAt: Date;
  performance: WalletPerformancePoint[]; // Historical performance data
}

interface WalletPerformancePoint {
  timestamp: Date;
  balance: number;
  pnl: number;
  pnlPercent: number;
}

interface Order {
  id: string;
  walletId: string; // Associated wallet
  symbol: string;
  type: 'long' | 'short';
  status: 'pending' | 'active' | 'filled' | 'cancelled' | 'expired' | 'closed';
  quantity: number;
  entryPrice: number;
  currentPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  expirationDate?: Date;
  createdAt: Date;
  filledAt?: Date;
  closedAt?: Date;
  pnl?: number;
  pnlPercent?: number;
  commission?: number;
}

interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  orders: string[]; // Order IDs
}

interface TradingState {
  // Simulator mode
  isSimulatorActive: boolean;
  toggleSimulator: () => void;
  
  // Wallets
  wallets: Wallet[];
  activeWalletId: string | null;
  addWallet: (name: string, initialBalance: number, currency: 'USD' | 'BRL' | 'EUR') => void;
  updateWallet: (id: string, updates: Partial<Wallet>) => void;
  deleteWallet: (id: string) => void;
  setActiveWallet: (id: string) => void;
  getActiveWallet: () => Wallet | null;
  updateWalletBalance: (walletId: string, amount: number) => void;
  recordWalletPerformance: (walletId: string) => void;
  
  // Orders
  orders: Order[];
  addOrder: (order: Omit<Order, 'id' | 'createdAt'>) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  cancelOrder: (id: string) => void;
  closeOrder: (id: string, closePrice: number) => void;
  
  // Positions (computed from orders)
  getPositions: (walletId?: string) => Position[];
  getPositionBySymbol: (symbol: string, walletId?: string) => Position | null;
  
  // Order filtering
  getOrdersBySymbol: (symbol: string) => Order[];
  getOrdersByWallet: (walletId: string) => Order[];
  getActiveOrders: () => Order[];
  
  // Settings
  defaultQuantity: number;
  setDefaultQuantity: (quantity: number) => void;
  defaultExpiration: 'day' | 'gtc' | 'custom';
  setDefaultExpiration: (type: 'day' | 'gtc' | 'custom') => void;
  
  // Price updates (from real-time data)
  updatePrices: (symbol: string, price: number) => void;
}
```

### 1.2 Shared Types
Add to `/src/shared/types/trading.ts`:
```typescript
export type OrderType = 'long' | 'short';
export type OrderStatus = 'pending' | 'active' | 'filled' | 'cancelled' | 'expired' | 'closed';
export type ExpirationType = 'day' | 'gtc' | 'custom';
export type WalletCurrency = 'USD' | 'BRL' | 'EUR';

export interface Wallet {
  id: string;
  name: string;
  balance: number;
  initialBalance: number;
  currency: WalletCurrency;
  createdAt: Date;
  performance: WalletPerformancePoint[];
}

export interface WalletPerformancePoint {
  timestamp: Date;
  balance: number;
  pnl: number;
  pnlPercent: number;
}

export interface OrderCreateParams {
  walletId: string;
  symbol: string;
  type: OrderType;
  quantity: number;
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  expirationDate?: Date;
}

export interface OrderUpdateParams {
  stopLoss?: number;
  takeProfit?: number;
  expirationDate?: Date;
}

export interface WalletCreateParams {
  name: string;
  initialBalance: number;
  currency: WalletCurrency;
}
```

---

## Phase 2: Keyboard Shortcuts for Order Entry

### 2.1 Keyboard Handler
Profit PRO da Nelogica uses:
- **Shift + Click**: Enter LONG position
- **Alt/Option + Click**: Enter SHORT position

Implement in `/src/renderer/hooks/useTradingShortcuts.ts`:
```typescript
interface TradingShortcutsConfig {
  onLongEntry: (price: number) => void;
  onShortEntry: (price: number) => void;
  enabled: boolean;
}

export const useTradingShortcuts = (config: TradingShortcutsConfig) => {
  // Track modifier keys state
  const [shiftPressed, setShiftPressed] = useState(false);
  const [altPressed, setAltPressed] = useState(false);
  
  useEffect(() => {
    if (!config.enabled) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(true);
      if (e.key === 'Alt' || e.key === 'Option') setAltPressed(true);
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(false);
      if (e.key === 'Alt' || e.key === 'Option') setAltPressed(false);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [config.enabled]);
  
  return { shiftPressed, altPressed };
};
```

### 2.2 Chart Canvas Integration
Update `ChartCanvas.tsx` to handle trading clicks:
```typescript
const handleChartClick = (event: MouseEvent) => {
  if (!isSimulatorActive) return;
  
  const price = convertYToPrice(event.offsetY); // Implement price conversion
  
  if (shiftPressed) {
    onLongEntry(price);
  } else if (altPressed) {
    onShortEntry(price);
  }
};
```

---

## Phase 3: Toolbar Toggle Button

### 3.1 Add Simulator Toggle
Update `/src/renderer/components/Layout/Toolbar.tsx`:

```typescript
import { LuPlay, LuPause } from 'react-icons/lu';

// Add to ToolbarProps
interface ToolbarProps {
  // ... existing props
  isSimulatorActive: boolean;
  onToggleSimulator: () => void;
}

// Add button in toolbar (after measurement tools)
<TooltipWrapper label={t('trading.simulator.toggle')} showArrow>
  <IconButton
    size="2xs"
    aria-label={t('trading.simulator.toggle')}
    onClick={onToggleSimulator}
    colorPalette={isSimulatorActive ? 'green' : 'gray'}
    variant={isSimulatorActive ? 'solid' : 'ghost'}
  >
    {isSimulatorActive ? <LuPause /> : <LuPlay />}
  </IconButton>
</TooltipWrapper>
```

---

## Phase 4: Chat Sidebar Repositioning

### 4.1 Chat Position Settings
Add to tradingStore or separate uiStore:
```typescript
interface UIState {
  chatPosition: 'left' | 'right';
  setChatPosition: (position: 'left' | 'right') => void;
}
```

### 4.2 Chat Options Menu
Create `/src/renderer/components/Chat/ChatOptionsMenu.tsx`:
```typescript
import { Menu } from '@chakra-ui/react';
import { LuSettings, LuAlignLeft, LuAlignRight } from 'react-icons/lu';

export const ChatOptionsMenu = () => {
  const { chatPosition, setChatPosition } = useUIStore();
  
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton
          size="sm"
          variant="ghost"
          aria-label="Chat options"
        >
          <LuSettings />
        </IconButton>
      </Menu.Trigger>
      <Menu.Content>
        <Menu.Item
          value="position-left"
          onClick={() => setChatPosition('left')}
        >
          <LuAlignLeft />
          <Text>{t('chat.options.positionLeft')}</Text>
        </Menu.Item>
        <Menu.Item
          value="position-right"
          onClick={() => setChatPosition('right')}
        >
          <LuAlignRight />
          <Text>{t('chat.options.positionRight')}</Text>
        </Menu.Item>
      </Menu.Content>
    </Menu.Root>
  );
};
```

### 4.3 MainLayout Updates
Update `/src/renderer/components/Layout/MainLayout.tsx`:
```typescript
const chatPosition = useUIStore(state => state.chatPosition);

// Conditional rendering based on position
<Flex>
  {chatPosition === 'left' && isChatOpen && (
    <ChatSidebar width={chatWidth} isOpen={isChatOpen} onToggle={toggleChat} />
  )}
  
  <Box flex={1}>
    {children}
  </Box>
  
  {chatPosition === 'right' && isChatOpen && (
    <ChatSidebar width={chatWidth} isOpen={isChatOpen} onToggle={toggleChat} />
  )}
</Flex>
```

---

## Phase 5: Trading Sidebar (Order Ticket & Portfolio)

### 5.1 TradingSidebar Component
Create `/src/renderer/components/Trading/TradingSidebar.tsx`:
```typescript
interface TradingSidebarProps {
  width: number;
  isOpen: boolean;
  onToggle: () => void;
}

export const TradingSidebar = ({ width, isOpen, onToggle }: TradingSidebarProps) => {
  return (
    <Flex
      direction="column"
      width={`${width}px`}
      minWidth="300px"
      height="100%"
      bg="bg.surface"
      borderLeft="1px solid"
      borderColor="border"
    >
      <TradingHeader onToggle={onToggle} />
      <Tabs.Root defaultValue="wallets">
        <Tabs.List>
          <Tabs.Trigger value="wallets">{t('trading.tabs.wallets')}</Tabs.Trigger>
          <Tabs.Trigger value="ticket">{t('trading.tabs.ticket')}</Tabs.Trigger>
          <Tabs.Trigger value="portfolio">{t('trading.tabs.portfolio')}</Tabs.Trigger>
          <Tabs.Trigger value="orders">{t('trading.tabs.orders')}</Tabs.Trigger>
        </Tabs.List>
        
        <Box flex={1} overflowY="auto">
          <Tabs.Content value="wallets">
            <WalletManager />
          </Tabs.Content>
          <Tabs.Content value="ticket">
            <OrderTicket />
          </Tabs.Content>
          <Tabs.Content value="portfolio">
            <Portfolio />
          </Tabs.Content>
          <Tabs.Content value="orders">
            <OrdersList />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Flex>
  );
};
```

### 5.2 WalletManager Component
Create `/src/renderer/components/Trading/WalletManager.tsx`:
```typescript
export const WalletManager = () => {
  const { wallets, activeWalletId, addWallet, setActiveWallet, deleteWallet } = useTradingStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPerformanceDialog, setShowPerformanceDialog] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  
  return (
    <Stack gap={2} p={4}>
      <Flex justify="space-between" align="center" mb={2}>
        <Text fontSize="sm" fontWeight="bold">
          {t('trading.wallets.title')}
        </Text>
        <Button
          size="sm"
          colorPalette="blue"
          onClick={() => setShowCreateDialog(true)}
        >
          <LuPlus />
          {t('trading.wallets.create')}
        </Button>
      </Flex>
      
      {wallets.length === 0 ? (
        <EmptyState message={t('trading.wallets.empty')} />
      ) : (
        wallets.map((wallet) => (
          <WalletCard
            key={wallet.id}
            wallet={wallet}
            isActive={wallet.id === activeWalletId}
            onSelect={() => setActiveWallet(wallet.id)}
            onDelete={() => deleteWallet(wallet.id)}
            onViewPerformance={() => {
              setSelectedWalletId(wallet.id);
              setShowPerformanceDialog(true);
            }}
          />
        ))
      )}
      
      <CreateWalletDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={addWallet}
      />
      
      <WalletPerformanceDialog
        isOpen={showPerformanceDialog}
        onClose={() => {
          setShowPerformanceDialog(false);
          setSelectedWalletId(null);
        }}
        walletId={selectedWalletId}
      />
    </Stack>
  );
};

const WalletCard = ({ wallet, isActive, onSelect, onDelete, onViewPerformance }: WalletCardProps) => {
  const totalPnL = wallet.balance - wallet.initialBalance;
  const totalPnLPercent = ((totalPnL / wallet.initialBalance) * 100);
  const isProfitable = totalPnL >= 0;
  
  return (
    <Box
      p={3}
      bg={isActive ? 'blue.50' : 'bg.muted'}
      borderRadius="md"
      borderLeft={`4px solid`}
      borderColor={isActive ? 'blue.500' : isProfitable ? 'green.500' : 'red.500'}
      cursor="pointer"
      onClick={onSelect}
      _hover={{ bg: isActive ? 'blue.100' : 'bg.subtle' }}
      _dark={{
        bg: isActive ? 'blue.900' : 'bg.muted',
        _hover: { bg: isActive ? 'blue.800' : 'bg.subtle' }
      }}
    >
      <Flex justify="space-between" align="center" mb={2}>
        <Text fontWeight="bold">{wallet.name}</Text>
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton
              size="xs"
              variant="ghost"
              aria-label="Wallet options"
              onClick={(e) => e.stopPropagation()}
            >
              <LuMoreVertical />
            </IconButton>
          </Menu.Trigger>
          <Menu.Content>
            <Menu.Item value="performance" onClick={onViewPerformance}>
              <LuTrendingUp />
              <Text>{t('trading.wallets.viewPerformance')}</Text>
            </Menu.Item>
            <Menu.Item value="delete" onClick={onDelete} color="red.500">
              <LuTrash2 />
              <Text>{t('trading.wallets.delete')}</Text>
            </Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </Flex>
      
      <Stack gap={1} fontSize="sm">
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.wallets.balance')}</Text>
          <Text fontWeight="medium">
            {wallet.currency} {wallet.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.wallets.initialBalance')}</Text>
          <Text>
            {wallet.currency} {wallet.initialBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.wallets.totalPnL')}</Text>
          <Text
            color={isProfitable ? 'green.500' : 'red.500'}
            fontWeight="medium"
          >
            {isProfitable ? '+' : ''}{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {' '}({isProfitable ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
          </Text>
        </Flex>
      </Stack>
    </Box>
  );
};
```

### 5.3 CreateWalletDialog Component
Create `/src/renderer/components/Trading/CreateWalletDialog.tsx`:
```typescript
interface CreateWalletDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, initialBalance: number, currency: WalletCurrency) => void;
}

export const CreateWalletDialog = ({ isOpen, onClose, onCreate }: CreateWalletDialogProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState(10000);
  const [currency, setCurrency] = useState<WalletCurrency>('USD');
  
  const handleSubmit = () => {
    if (!name.trim()) return;
    if (initialBalance <= 0) return;
    
    onCreate(name.trim(), initialBalance, currency);
    setName('');
    setInitialBalance(10000);
    setCurrency('USD');
    onClose();
  };
  
  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>{t('trading.wallets.createTitle')}</Dialog.Title>
          </Dialog.Header>
          
          <Dialog.Body>
            <Stack gap={4}>
              <Field label={t('trading.wallets.name')}>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('trading.wallets.namePlaceholder')}
                />
              </Field>
              
              <Field label={t('trading.wallets.initialBalance')}>
                <NumberInput
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(Number(e.target.value))}
                  min={1}
                  step={100}
                />
              </Field>
              
              <Field label={t('trading.wallets.currency')}>
                <Select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as WalletCurrency)}
                  options={[
                    { value: 'USD', label: 'USD ($)' },
                    { value: 'BRL', label: 'BRL (R$)' },
                    { value: 'EUR', label: 'EUR (€)' },
                  ]}
                />
              </Field>
            </Stack>
          </Dialog.Body>
          
          <Dialog.Footer>
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              colorPalette="blue"
              onClick={handleSubmit}
              disabled={!name.trim() || initialBalance <= 0}
            >
              {t('trading.wallets.create')}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
```

### 5.4 WalletPerformanceDialog Component
Create `/src/renderer/components/Trading/WalletPerformanceDialog.tsx`:
```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface WalletPerformanceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  walletId: string | null;
}

export const WalletPerformanceDialog = ({ isOpen, onClose, walletId }: WalletPerformanceDialogProps) => {
  const { t } = useTranslation();
  const { wallets } = useTradingStore();
  const wallet = wallets.find(w => w.id === walletId);
  
  if (!wallet) return null;
  
  const chartData = wallet.performance.map(p => ({
    date: new Date(p.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    balance: p.balance,
    initialBalance: wallet.initialBalance,
    pnl: p.pnl,
  }));
  
  const formatCurrency = (value: number) => {
    return `${wallet.currency} ${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };
  
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box p={2} bg="bg.panel" borderRadius="md" borderWidth="1px" borderColor="border">
          <Text fontSize="xs" fontWeight="medium" mb={1}>{payload[0].payload.date}</Text>
          <Stack gap={0.5} fontSize="xs">
            <Text color="blue.500">
              {t('trading.wallets.balance')}: {formatCurrency(payload[0].value)}
            </Text>
            <Text color="fg.muted">
              {t('trading.wallets.initialBalance')}: {formatCurrency(payload[1].value)}
            </Text>
          </Stack>
        </Box>
      );
    }
    return null;
  };
  
  const totalPnL = wallet.balance - wallet.initialBalance;
  const totalPnLPercent = ((totalPnL / wallet.initialBalance) * 100);
  const isProfitable = totalPnL >= 0;
  
  const tradeDays = wallet.performance.length;
  const avgDailyReturn = tradeDays > 1 
    ? (wallet.performance[wallet.performance.length - 1].balance - wallet.performance[0].balance) / tradeDays
    : 0;
  
  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="xl">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxH="85vh">
          <Dialog.Header>
            <Dialog.Title>{t('trading.wallets.performanceTitle', { name: wallet.name })}</Dialog.Title>
          </Dialog.Header>
          
          <Dialog.Body overflowY="auto">
            <Stack gap={4}>
              {/* Summary Stats */}
              <Box p={4} bg="bg.muted" borderRadius="md">
                <Stack gap={2}>
                  <Flex justify="space-between">
                    <Text fontWeight="medium">{t('trading.wallets.currentBalance')}</Text>
                    <Text fontSize="lg" fontWeight="bold">
                      {wallet.currency} {wallet.balance.toLocaleString(undefined, { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text color="fg.muted">{t('trading.wallets.totalPnL')}</Text>
                    <Text
                      color={isProfitable ? 'green.500' : 'red.500'}
                      fontWeight="medium"
                    >
                      {isProfitable ? '+' : ''}{totalPnL.toLocaleString(undefined, { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                      {' '}({isProfitable ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
                    </Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text color="fg.muted">{t('trading.wallets.tradeDays')}</Text>
                    <Text>{tradeDays}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text color="fg.muted">{t('trading.wallets.avgDailyReturn')}</Text>
                    <Text>
                      {wallet.currency} {avgDailyReturn.toLocaleString(undefined, { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </Text>
                  </Flex>
                </Stack>
              </Box>
              
              {/* Performance Chart */}
              <Box h="400px">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      tickFormatter={(value) => `${wallet.currency} ${value.toLocaleString()}`}
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <defs>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorBalance)"
                      name={t('trading.wallets.balance')}
                    />
                    <Line
                      type="monotone"
                      dataKey="initialBalance"
                      stroke="#9ca3af"
                      strokeDasharray="5 5"
                      dot={false}
                      name={t('trading.wallets.initialBalance')}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Stack>
          </Dialog.Body>
          
          <Dialog.Footer>
            <Button onClick={onClose}>
              {t('common.close')}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
```

### 5.5 OrderTicket Component
Create `/src/renderer/components/Trading/OrderTicket.tsx`:
```typescript
export const OrderTicket = () => {
  const { symbol } = useChartContext();
  const { getActiveWallet, defaultQuantity, setDefaultQuantity, addOrder } = useTradingStore();
  const [quantity, setQuantity] = useState(defaultQuantity);
  const [orderType, setOrderType] = useState<OrderType>('long');
  const [expirationType, setExpirationType] = useState<ExpirationType>('day');
  const [customExpiration, setCustomExpiration] = useState<Date>();
  
  const activeWallet = getActiveWallet();
  const currentPrice = 50000; // Get from real-time data
  
  const totalCost = currentPrice * quantity;
  const canAfford = activeWallet ? activeWallet.balance >= totalCost : false;
  
  const handleSubmit = () => {
    if (!activeWallet) return;
    if (!canAfford) return;
    
    addOrder({
      walletId: activeWallet.id,
      symbol,
      type: orderType,
      quantity,
      entryPrice: currentPrice,
      expirationDate: expirationType === 'custom' ? customExpiration : undefined,
      status: 'pending',
    });
  };
  
  return (
    <Stack gap={4} p={4}>
      {!activeWallet ? (
        <Box p={4} bg="orange.50" borderRadius="md" borderLeft="4px solid" borderColor="orange.500">
          <Text fontSize="sm" color="orange.700">
            {t('trading.ticket.noWallet')}
          </Text>
        </Box>
      ) : (
        <>
          <Box p={3} bg="bg.muted" borderRadius="md">
            <Stack gap={1} fontSize="sm">
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.ticket.activeWallet')}</Text>
                <Text fontWeight="medium">{activeWallet.name}</Text>
              </Flex>
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.ticket.availableBalance')}</Text>
                <Text fontWeight="medium">
                  {activeWallet.currency} {activeWallet.balance.toLocaleString(undefined, { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </Text>
              </Flex>
            </Stack>
          </Box>
          
          <Field label={t('trading.ticket.symbol')}>
            <Input value={symbol} readOnly />
          </Field>
          
          <Field label={t('trading.ticket.orderType')}>
            <Select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as OrderType)}
              options={[
                { value: 'long', label: t('trading.ticket.long') },
                { value: 'short', label: t('trading.ticket.short') },
              ]}
            />
          </Field>
          
          <Field label={t('trading.ticket.quantity')}>
            <NumberInput
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              min={1}
            />
          </Field>
          
          <Field label={t('trading.ticket.price')}>
            <Input value={currentPrice.toLocaleString()} readOnly />
          </Field>
          
          <Box p={3} bg={canAfford ? 'blue.50' : 'red.50'} borderRadius="md">
            <Flex justify="space-between">
              <Text fontSize="sm" fontWeight="medium">
                {t('trading.ticket.totalCost')}
              </Text>
              <Text fontSize="sm" fontWeight="bold" color={canAfford ? 'blue.700' : 'red.700'}>
                {activeWallet.currency} {totalCost.toLocaleString(undefined, { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </Text>
            </Flex>
            {!canAfford && (
              <Text fontSize="xs" color="red.700" mt={1}>
                {t('trading.ticket.insufficientBalance')}
              </Text>
            )}
          </Box>
          
          <Field label={t('trading.ticket.expiration')}>
            <Select
              value={expirationType}
              onChange={(e) => setExpirationType(e.target.value as ExpirationType)}
              options={[
                { value: 'day', label: t('trading.ticket.expirationDay') },
                { value: 'gtc', label: t('trading.ticket.expirationGTC') },
                { value: 'custom', label: t('trading.ticket.expirationCustom') },
              ]}
            />
          </Field>
          
          {expirationType === 'custom' && (
            <Field label={t('trading.ticket.customDate')}>
              <Input
                type="datetime-local"
                onChange={(e) => setCustomExpiration(new Date(e.target.value))}
              />
            </Field>
          )}
          
          <Button
            colorPalette={orderType === 'long' ? 'green' : 'red'}
            onClick={handleSubmit}
            disabled={!canAfford}
          >
            {orderType === 'long' ? t('trading.ticket.buy') : t('trading.ticket.sell')}
          </Button>
        </>
      )}
    </Stack>
  );
};
```

### 5.6 Portfolio Component
Create `/src/renderer/components/Trading/Portfolio.tsx`:
```typescript
export const Portfolio = () => {
  const { getPositions, getActiveWallet } = useTradingStore();
  const activeWallet = getActiveWallet();
  const positions = activeWallet ? getPositions(activeWallet.id) : [];
  
  return (
    <Stack gap={2} p={4}>
      {!activeWallet ? (
        <EmptyState message={t('trading.portfolio.noWallet')} />
      ) : positions.length === 0 ? (
        <EmptyState message={t('trading.portfolio.empty')} />
      ) : (
        positions.map((position) => (
          <PositionCard key={position.symbol} position={position} wallet={activeWallet} />
        ))
      )}
    </Stack>
  );
};

const PositionCard = ({ position, wallet }: { position: Position; wallet: Wallet }) => {
  const isProfitable = position.pnl >= 0;
  
  return (
    <Box
      p={3}
      bg="bg.muted"
      borderRadius="md"
      borderLeft={`4px solid`}
      borderColor={isProfitable ? 'green.500' : 'red.500'}
    >
      <Flex justify="space-between" mb={2}>
        <Text fontWeight="bold">{position.symbol}</Text>
        <Text
          fontSize="sm"
          color={isProfitable ? 'green.500' : 'red.500'}
          fontWeight="medium"
        >
          {isProfitable ? '+' : ''}{position.pnlPercent.toFixed(2)}%
        </Text>
      </Flex>
      <Stack gap={1} fontSize="sm">
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.portfolio.quantity')}</Text>
          <Text>{position.quantity}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.portfolio.avgPrice')}</Text>
          <Text>{wallet.currency} {position.avgPrice.toLocaleString()}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.portfolio.currentPrice')}</Text>
          <Text>{wallet.currency} {position.currentPrice.toLocaleString()}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.portfolio.pnl')}</Text>
          <Text color={isProfitable ? 'green.500' : 'red.500'}>
            {wallet.currency} {position.pnl.toLocaleString()}
          </Text>
        </Flex>
      </Stack>
    </Box>
  );
};
```

### 5.7 OrdersList Component
Create `/src/renderer/components/Trading/OrdersList.tsx`:
```typescript
export const OrdersList = () => {
  const { orders, cancelOrder, closeOrder } = useTradingStore();
  const { symbol } = useChartContext();
  const [filterSymbol, setFilterSymbol] = useState(false);
  
  const filteredOrders = filterSymbol
    ? orders.filter(o => o.symbol === symbol)
    : orders;
  
  return (
    <Stack gap={2} p={4}>
      <Flex justify="space-between" align="center" mb={2}>
        <Text fontSize="sm" fontWeight="bold">
          {t('trading.orders.title')}
        </Text>
        <Switch
          checked={filterSymbol}
          onCheckedChange={(e) => setFilterSymbol(e.checked)}
        >
          {t('trading.orders.currentSymbolOnly')}
        </Switch>
      </Flex>
      
      {filteredOrders.length === 0 ? (
        <EmptyState message={t('trading.orders.empty')} />
      ) : (
        filteredOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onCancel={() => cancelOrder(order.id)}
            onClose={(price) => closeOrder(order.id, price)}
          />
        ))
      )}
    </Stack>
  );
};

const OrderCard = ({ order, onCancel, onClose }: OrderCardProps) => {
  const statusColor = {
    pending: 'gray',
    active: 'blue',
    filled: 'green',
    cancelled: 'orange',
    expired: 'red',
    closed: 'purple',
  }[order.status];
  
  return (
    <Box p={3} bg="bg.muted" borderRadius="md">
      <Flex justify="space-between" align="center" mb={2}>
        <HStack gap={2}>
          <Badge colorPalette={statusColor}>{order.status}</Badge>
          <Badge colorPalette={order.type === 'long' ? 'green' : 'red'}>
            {order.type.toUpperCase()}
          </Badge>
        </HStack>
        <Text fontSize="xs" color="fg.muted">
          {order.symbol}
        </Text>
      </Flex>
      
      <Stack gap={1} fontSize="sm">
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.orders.quantity')}</Text>
          <Text>{order.quantity}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.orders.entryPrice')}</Text>
          <Text>${order.entryPrice.toLocaleString()}</Text>
        </Flex>
        {order.stopLoss && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.stopLoss')}</Text>
            <Text color="red.500">${order.stopLoss.toLocaleString()}</Text>
          </Flex>
        )}
        {order.takeProfit && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.takeProfit')}</Text>
            <Text color="green.500">${order.takeProfit.toLocaleString()}</Text>
          </Flex>
        )}
        {order.pnl !== undefined && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.pnl')}</Text>
            <Text color={order.pnl >= 0 ? 'green.500' : 'red.500'}>
              {order.pnl >= 0 ? '+' : ''}${order.pnl.toLocaleString()}
            </Text>
          </Flex>
        )}
      </Stack>
      
      <HStack gap={2} mt={3}>
        {order.status === 'active' && (
          <Button
            size="sm"
            colorPalette="blue"
            onClick={() => onClose(order.currentPrice || order.entryPrice)}
          >
            {t('trading.orders.close')}
          </Button>
        )}
        {(order.status === 'pending' || order.status === 'active') && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {t('trading.orders.cancel')}
          </Button>
        )}
      </HStack>
    </Box>
  );
};
```

---

## Phase 6: Chart Visualization - Orders & Stop/Target Lines

### 6.1 OrderRenderer Component
Create `/src/renderer/components/Chart/OrderRenderer.tsx`:
```typescript
interface OrderRendererProps {
  orders: Order[];
  viewport: Viewport;
  priceToY: (price: number) => number;
  colors: ChartThemeColors;
}

export const useOrderRenderer = ({
  orders,
  viewport,
  priceToY,
  colors,
}: OrderRendererProps) => {
  const render = useCallback((ctx: CanvasRenderingContext2D) => {
    orders.forEach(order => {
      if (order.status === 'cancelled' || order.status === 'expired') return;
      
      const y = priceToY(order.entryPrice);
      const color = order.type === 'long' ? colors.bullish : colors.bearish;
      
      // Entry line
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ctx.canvas.width, y);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Entry marker
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(10, y, 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Stop loss line
      if (order.stopLoss) {
        const stopY = priceToY(order.stopLoss);
        ctx.strokeStyle = colors.bearish;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(0, stopY);
        ctx.lineTo(ctx.canvas.width, stopY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      
      // Take profit line
      if (order.takeProfit) {
        const targetY = priceToY(order.takeProfit);
        ctx.strokeStyle = colors.bullish;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(0, targetY);
        ctx.lineTo(ctx.canvas.width, targetY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }, [orders, viewport, priceToY, colors]);
  
  return { render };
};
```

### 6.2 Drag-to-Create Stop/Target
Create `/src/renderer/hooks/useOrderDragHandler.ts`:
```typescript
interface OrderDragConfig {
  orders: Order[];
  updateOrder: (id: string, updates: Partial<Order>) => void;
  priceToY: (price: number) => number;
  yToPrice: (y: number) => number;
  enabled: boolean;
}

export const useOrderDragHandler = (config: OrderDragConfig) => {
  const [draggedOrder, setDraggedOrder] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'stop' | 'target' | null>(null);
  const [dragStartY, setDragStartY] = useState(0);
  
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (!config.enabled) return;
    
    const y = e.offsetY;
    
    // Find order near click
    for (const order of config.orders) {
      const entryY = config.priceToY(order.entryPrice);
      if (Math.abs(y - entryY) < 10) {
        setDraggedOrder(order.id);
        setDragStartY(y);
        
        // Determine drag direction for stop/target
        // Will be set on mousemove
        break;
      }
    }
  }, [config]);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggedOrder) return;
    
    const currentY = e.offsetY;
    const order = config.orders.find(o => o.id === draggedOrder);
    if (!order) return;
    
    const entryY = config.priceToY(order.entryPrice);
    const direction = currentY < entryY ? 'up' : 'down';
    
    // Up = target for long, stop for short
    // Down = stop for long, target for short
    const isTarget = 
      (order.type === 'long' && direction === 'up') ||
      (order.type === 'short' && direction === 'down');
    
    setDragType(isTarget ? 'target' : 'stop');
    
    const price = config.yToPrice(currentY);
    
    config.updateOrder(draggedOrder, {
      [isTarget ? 'takeProfit' : 'stopLoss']: price,
    });
  }, [draggedOrder, config]);
  
  const handleMouseUp = useCallback(() => {
    setDraggedOrder(null);
    setDragType(null);
  }, []);
  
  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    isDragging: !!draggedOrder,
    dragType,
  };
};
```

---

## Phase 7: Automatic Position Management

### 7.1 Price Update System
Create `/src/renderer/hooks/useTradingPriceUpdater.ts`:
```typescript
export const useTradingPriceUpdater = () => {
  const { updatePrices, orders, updateOrder } = useTradingStore();
  const { chartData } = useChartContext();
  
  useEffect(() => {
    if (!chartData?.klines.length) return;
    
    const latestKline = chartData.klines[chartData.klines.length - 1];
    const currentPrice = latestKline.close;
    
    // Update all orders for this symbol
    updatePrices(chartData.symbol, currentPrice);
    
    // Check for stop loss / take profit hits
    orders.forEach(order => {
      if (order.symbol !== chartData.symbol) return;
      if (order.status !== 'active') return;
      
      // Check stop loss
      if (order.stopLoss) {
        const hitStop = order.type === 'long'
          ? currentPrice <= order.stopLoss
          : currentPrice >= order.stopLoss;
        
        if (hitStop) {
          updateOrder(order.id, {
            status: 'closed',
            closedAt: new Date(),
            pnl: (order.stopLoss - order.entryPrice) * order.quantity * (order.type === 'long' ? 1 : -1),
          });
        }
      }
      
      // Check take profit
      if (order.takeProfit) {
        const hitTarget = order.type === 'long'
          ? currentPrice >= order.takeProfit
          : currentPrice <= order.takeProfit;
        
        if (hitTarget) {
          updateOrder(order.id, {
            status: 'closed',
            closedAt: new Date(),
            pnl: (order.takeProfit - order.entryPrice) * order.quantity * (order.type === 'long' ? 1 : -1),
          });
        }
      }
    });
  }, [chartData, orders, updatePrices, updateOrder]);
};
```

### 7.2 Expiration Checker
Create `/src/renderer/hooks/useTradingExpirationChecker.ts`:
```typescript
export const useTradingExpirationChecker = () => {
  const { orders, updateOrder } = useTradingStore();
  
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      
      orders.forEach(order => {
        if (!order.expirationDate) return;
        if (order.status !== 'pending' && order.status !== 'active') return;
        
        if (now >= order.expirationDate) {
          updateOrder(order.id, {
            status: 'expired',
          });
        }
      });
    }, 1000); // Check every second
    
    return () => clearInterval(interval);
  }, [orders, updateOrder]);
};
```

---

## Phase 8: Layout Integration & Auto-Positioning

### 8.1 Simulator Mode Layout Manager
Create `/src/renderer/hooks/useSimulatorLayout.ts`:
```typescript
export const useSimulatorLayout = () => {
  const { isSimulatorActive } = useTradingStore();
  const { chatPosition, setChatPosition } = useUIStore();
  const prevPositionRef = useRef<'left' | 'right'>('right');
  
  useEffect(() => {
    if (isSimulatorActive) {
      // Save current position
      prevPositionRef.current = chatPosition;
      // Move chat to left
      setChatPosition('left');
    } else {
      // Restore previous position
      setChatPosition(prevPositionRef.current);
    }
  }, [isSimulatorActive, chatPosition, setChatPosition]);
};
```

### 8.2 MainLayout with Trading Sidebar
Update `/src/renderer/components/Layout/MainLayout.tsx`:
```typescript
const { isSimulatorActive } = useTradingStore();
const [tradingWidth, setTradingWidth] = useLocalStorage('trading-sidebar-width', 400);

return (
  <Flex>
    {/* Chat on left when simulator active */}
    {chatPosition === 'left' && isChatOpen && (
      <ChatSidebar width={chatWidth} isOpen={isChatOpen} onToggle={toggleChat} />
    )}
    
    {/* Chart area */}
    <Box flex={1}>
      {children}
    </Box>
    
    {/* Trading sidebar on right when simulator active */}
    {isSimulatorActive && (
      <TradingSidebar
        width={tradingWidth}
        isOpen={true}
        onToggle={() => {}}
      />
    )}
    
    {/* Chat on right when simulator inactive */}
    {chatPosition === 'right' && isChatOpen && !isSimulatorActive && (
      <ChatSidebar width={chatWidth} isOpen={isChatOpen} onToggle={toggleChat} />
    )}
  </Flex>
);
```

---

## Phase 9: Internationalization (i18n)

### 9.1 Translation Keys
Add to `/src/renderer/locales/en.json`:
```json
{
  "trading": {
    "simulator": {
      "toggle": "Trading Simulator",
      "active": "Simulator Active",
      "inactive": "Simulator Inactive"
    },
    "tabs": {
      "wallets": "Wallets",
      "ticket": "Order Ticket",
      "portfolio": "Portfolio",
      "orders": "Orders"
    },
    "wallets": {
      "title": "Wallets",
      "create": "Create Wallet",
      "createTitle": "Create New Wallet",
      "empty": "No wallets created",
      "name": "Wallet Name",
      "namePlaceholder": "My Trading Wallet",
      "balance": "Balance",
      "initialBalance": "Initial Balance",
      "currency": "Currency",
      "totalPnL": "Total P&L",
      "tradeDays": "Trade Days",
      "avgDailyReturn": "Avg Daily Return",
      "currentBalance": "Current Balance",
      "viewPerformance": "View Performance",
      "performanceTitle": "Performance - {{name}}",
      "performanceChart": "Balance Over Time - {{name}}",
      "delete": "Delete Wallet"
    },
    "ticket": {
      "symbol": "Symbol",
      "orderType": "Order Type",
      "long": "Buy (Long)",
      "short": "Sell (Short)",
      "quantity": "Quantity",
      "price": "Price",
      "expiration": "Expiration",
      "expirationDay": "Day",
      "expirationGTC": "Good Till Cancel",
      "expirationCustom": "Custom",
      "customDate": "Expiration Date",
      "buy": "Buy",
      "sell": "Sell",
      "activeWallet": "Active Wallet",
      "availableBalance": "Available Balance",
      "totalCost": "Total Cost",
      "insufficientBalance": "Insufficient balance",
      "noWallet": "Please create and select a wallet first"
    },
    "portfolio": {
      "empty": "No open positions",
      "noWallet": "No wallet selected",
      "quantity": "Quantity",
      "avgPrice": "Avg Price",
      "currentPrice": "Current Price",
      "pnl": "P&L"
    },
    "orders": {
      "title": "Orders",
      "empty": "No orders",
      "currentSymbolOnly": "Current symbol only",
      "quantity": "Quantity",
      "entryPrice": "Entry",
      "stopLoss": "Stop Loss",
      "takeProfit": "Take Profit",
      "pnl": "P&L",
      "close": "Close",
      "cancel": "Cancel"
    },
    "shortcuts": {
      "longEntry": "Long Entry (Shift + Click)",
      "shortEntry": "Short Entry (Alt + Click)"
    }
  },
  "chat": {
    "options": {
      "menu": "Chat Options",
      "positionLeft": "Position Left",
      "positionRight": "Position Right"
    }
  }
}
```

Replicate for PT, ES, FR.

---

## Phase 10: Testing Strategy

### 10.1 Unit Tests
Create test files:
- `/src/renderer/store/tradingStore.test.ts`
- `/src/renderer/hooks/useTradingShortcuts.test.ts`
- `/src/renderer/components/Trading/OrderTicket.test.tsx`
- `/src/renderer/components/Trading/Portfolio.test.tsx`
- `/src/renderer/components/Trading/OrdersList.test.tsx`

### 10.2 Integration Tests
- Test simulator activation/deactivation
- Test chat repositioning
- Test order creation flow
- Test stop/target drag
- Test price updates and auto-close
- Test expiration logic

### 10.3 E2E Tests (Manual)
1. Enable simulator mode
2. Create long position with Shift+Click
3. Create short position with Alt+Click
4. Drag to create stop loss
5. Drag to create take profit
6. Verify order appears in list
7. Verify position in portfolio
8. Switch symbols, verify orders filtered
9. Close position manually
10. Let position hit stop/target automatically
11. Verify expiration logic

---

## Phase 11: Future Enhancements

### Historical Replay Mode
1. Date selector to choose replay start date
2. Playback controls (play, pause, speed)
3. Step forward/backward kline-by-kline
4. Simulate real-time price updates from historical data
5. Order execution based on historical prices

### Advanced Features
- Multiple wallets with independent balances and performance tracking ✅
- Wallet performance visualization with Recharts ✅
- Multiple currencies (USD, BRL, EUR) ✅
- Balance validation before order placement ✅
- Multiple position sizing options (% of capital, fixed $, risk-based)
- Commission/fees simulation ✅
- Slippage simulation
- Partial position closing
- Trailing stop loss
- OCO (One-Cancels-Other) orders
- Bracket orders (entry + stop + target in one)
- Performance analytics (win rate, avg profit, Sharpe ratio)
- Trade journal with notes
- Export trade history to CSV
- Export wallet performance to CSV
- Position heat map on chart
- Risk/reward ratio calculator
- Wallet comparison view (side-by-side performance)
- Portfolio diversification metrics
- Max drawdown calculation

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Check and install latest versions of dependencies:
  - [ ] `recharts` - Consult https://recharts.org/en-US/api for latest chart APIs
  - [ ] `nanoid` (already installed) - Verify latest ID generation API
  - [ ] Verify Zustand persist middleware API - https://zustand-demo.pmnd.rs/
- [ ] Review Chakra UI v3 latest documentation for Dialog, Menu, Tabs components
- [ ] Create tradingStore.ts with full state management (including wallets)
  - [ ] Use latest Zustand patterns from official docs
  - [ ] Implement persist middleware with latest API
- [ ] Create trading types in shared/types/trading.ts (including Wallet types)
- [ ] Add uiStore.ts for chat positioning
- [ ] Set up store exports in store/index.ts

### Phase 2: Keyboard & Interaction
- [ ] Implement useTradingShortcuts hook
- [ ] Update ChartCanvas with trading click handlers
- [ ] Add price conversion utilities (yToPrice, priceToY)

### Phase 3: UI Components
- [ ] Review Chakra UI v3 component APIs before implementation:
  - [ ] Dialog component - https://www.chakra-ui.com/docs/components/dialog
  - [ ] Menu component - https://www.chakra-ui.com/docs/components/menu
  - [ ] Tabs component - https://www.chakra-ui.com/docs/components/tabs
  - [ ] Select component - https://www.chakra-ui.com/docs/components/select
- [ ] Add simulator toggle button to Toolbar
- [ ] Create ChatOptionsMenu component (using latest Menu API)
- [ ] Update MainLayout for dynamic chat positioning
- [ ] Create TradingSidebar component
- [ ] Create WalletManager component
- [ ] Create CreateWalletDialog component (using latest Dialog API)
- [ ] Create WalletPerformanceDialog component:
  - [ ] Review Recharts latest API - https://recharts.org/en-US/api
  - [ ] Implement AreaChart, Line, Tooltip with latest props
  - [ ] Use ResponsiveContainer with latest API
- [ ] Create WalletCard subcomponent
- [ ] Create OrderTicket component (with wallet balance validation)
- [ ] Create Portfolio component (wallet-aware)
- [ ] Create OrdersList component
- [ ] Create PositionCard subcomponent
- [ ] Create OrderCard subcomponent

### Phase 4: Chart Visualization
- [ ] Create OrderRenderer hook
- [ ] Create useOrderDragHandler hook
- [ ] Integrate renderers into ChartCanvas
- [ ] Add visual feedback for dragging

### Phase 5: Automation & Logic
- [ ] Create useTradingPriceUpdater hook
- [ ] Create useTradingExpirationChecker hook
- [ ] Implement PnL calculation logic
- [ ] Implement position aggregation logic (wallet-aware)
- [ ] Implement wallet balance updates on order close
- [ ] Implement wallet performance tracking (daily snapshots)
- [ ] Add commission deduction logic

### Phase 6: Layout & Integration
- [ ] Create useSimulatorLayout hook
- [ ] Update MainLayout with trading sidebar
- [ ] Add resize functionality for trading sidebar
- [ ] Test all layout combinations

### Phase 7: Internationalization
- [ ] Review react-i18next latest API - https://react.i18next.com/
- [ ] Check useTranslation hook latest features
- [ ] Verify interpolation syntax for dynamic values (e.g., wallet names, currencies)
- [ ] Add translation keys (EN, PT, ES, FR)
- [ ] Update all components with t() calls using latest i18next patterns
- [ ] Test language switching with latest i18next configuration

### Phase 8: Testing
- [ ] Write unit tests for tradingStore (including wallet operations)
- [ ] Write unit tests for wallet performance tracking
- [ ] Write component tests for WalletManager
- [ ] Write component tests for WalletPerformanceDialog
- [ ] Write component tests for OrderTicket (with balance validation)
- [ ] Write component tests for Portfolio
- [ ] Write component tests for OrdersList
- [ ] Write integration tests for wallet balance updates
- [ ] Write integration tests for performance tracking
- [ ] Manual E2E testing
- [ ] Fix bugs and edge cases

### Phase 9: Documentation
- [ ] Update CHANGELOG.md
- [ ] Create TRADING_SIMULATOR.md guide
- [ ] Update keyboard shortcuts documentation
- [ ] Add simulator section to README.md

---

## Git Branch Strategy

```bash
# Create feature branch
git checkout develop
git pull origin develop
git checkout -b feature/trading-simulator

# Work in incremental commits
git add .
git commit -m "feat: add trading store with order management"
git commit -m "feat: add keyboard shortcuts for order entry"
git commit -m "feat: add trading sidebar with order ticket"
# ... continue

# When complete, push and create PR
git push origin feature/trading-simulator
# Open PR to develop
```

---

## Notes & Considerations

1. **Real-time Price Updates**: Currently using latest kline close. For true real-time, integrate WebSocket updates.

2. **Order Execution**: Currently instant execution. Could add slippage simulation or market depth.

3. **Performance**: With many orders, canvas rendering could slow down. Consider virtualizing order list and only rendering visible orders.

4. **Persistence**: Orders and wallets are stored in Zustand with persist middleware. Consider moving to electron-store for larger datasets or implementing backup/restore functionality.

5. **Multi-Symbol**: Full support for trading multiple symbols simultaneously with proper isolation per wallet.

6. **Profit PRO Compatibility**: Using same shortcuts (Shift/Alt) for familiarity but can be customized.

7. **Historical Replay**: Complex feature, implement after core simulator is stable.

8. **Chart Interactions**: Clicking on orders should show details. Right-click for quick actions (cancel, modify).

9. **Accessibility**: Ensure all trading actions have keyboard alternatives, proper ARIA labels.

10. **Error Handling**: Validate inputs, handle edge cases (negative quantities, invalid prices, past expiration dates, insufficient balance).

11. **Wallet Performance**: Daily snapshots are taken at midnight or when significant balance changes occur. Recharts provides interactive, responsive performance visualization with gradient fills and custom tooltips.

12. **Currency Conversion**: Currently each wallet has a fixed currency. Future enhancement could add multi-currency conversion for portfolio aggregation.

13. **Commission Structure**: Can be configured as fixed amount or percentage. Applied when orders are filled.

14. **Library Versions**: Always consult official documentation for latest APIs:
    - Recharts API may have changed - verify component props and event handlers
    - Zustand persist middleware may have new configuration options
    - Chakra UI v3 has different patterns than v2 - check migration guide
    - React i18next interpolation syntax should match latest version
    - Nanoid may have new customization options for ID generation

---

## Timeline Estimate

- **Phase 1-2** (Foundation + Keyboard): 5-7 hours
- **Phase 3** (UI Components + Wallets): 12-15 hours
- **Phase 4** (Chart Visualization): 4-6 hours
- **Phase 5** (Automation + Wallet Logic): 6-8 hours
- **Phase 6** (Layout Integration): 3-4 hours
- **Phase 7** (i18n): 3-4 hours
- **Phase 8** (Testing): 8-10 hours
- **Phase 9** (Documentation): 2-3 hours

**Total: 43-61 hours** (approximately 1.5-2.5 weeks of full-time work)

---

## Success Criteria

✅ Simulator mode can be toggled from toolbar
✅ Multiple wallets can be created with custom names and balances
✅ Wallets support USD, BRL, and EUR currencies
✅ Active wallet can be selected from wallet list
✅ Wallet performance chart displays balance over time
✅ Wallet performance metrics calculated correctly (total P&L, avg daily return)
✅ Order ticket validates sufficient balance before placing orders
✅ Orders deduct from wallet balance when filled
✅ Closed orders add P&L to wallet balance
✅ Shift+Click enters long position at current price
✅ Alt+Click enters short position at current price
✅ Orders appear as lines on chart
✅ Drag from order line creates stop/target
✅ Trading sidebar shows wallets, order ticket, portfolio, and orders
✅ Chat automatically repositions to left when simulator active
✅ Orders are filtered by symbol on chart
✅ All orders visible in orders list (across all wallets)
✅ Portfolio aggregates positions per wallet
✅ Orders auto-close on stop/target hit
✅ Orders expire based on expiration date
✅ PnL calculated correctly with commission
✅ Wallet performance tracked daily
✅ Multi-language support (EN, PT, ES, FR)
✅ All tests passing
✅ Documentation complete

---

**End of Implementation Plan**
