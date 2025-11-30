# Storage Solutions Guide

## Overview

MarketMind uses different storage solutions for different types of data. This guide explains when to use each one.

---

## Available Storage Solutions

### 1. **localStorage** (Browser API)
**Location:** Browser's local storage  
**Encryption:** ❌ No (plain text)  
**Persistence:** ✅ Yes (until cleared)  
**Access:** Renderer process only  
**Size Limit:** ~5-10MB  

#### When to Use:
- ✅ UI preferences (theme, layout settings)
- ✅ Chart configurations (timeframe, indicators, colors)
- ✅ Non-sensitive user preferences
- ✅ Temporary UI state
- ✅ Data that needs fast synchronous access

#### When NOT to Use:
- ❌ API keys or sensitive credentials
- ❌ Large datasets (>5MB)
- ❌ Data that needs encryption
- ❌ Data that needs to be shared between renderer and main process

#### Current Usage in Project:
```typescript
// useLocalStorage hook
const [symbol, setSymbol] = useLocalStorage('marketmind:symbol', 'BTCUSDT');
const [showVolume, setShowVolume] = useLocalStorage('marketmind:showVolume', true);
const [chartType, setChartType] = useLocalStorage('marketmind:chartType', 'kline');
const [timeframe, setTimeframe] = useLocalStorage('marketmind:timeframe', '1d');
const [movingAverages, setMovingAverages] = useLocalStorage('marketmind:movingAverages', [...]);
```

**Files:**
- `src/renderer/hooks/useLocalStorage.ts` - React hook
- Used in: `App.tsx`, various components

---

### 2. **electron-store** (Electron Store)
**Location:** OS-specific app data folder  
**Encryption:** ⚠️ Optional (with safeStorage)  
**Persistence:** ✅ Yes (permanent until deleted)  
**Access:** Main process (can be exposed to renderer via IPC)  
**Size Limit:** No practical limit  

#### When to Use:
- ✅ Application settings that need to persist across sessions
- ✅ Data that needs to be accessed from main process
- ✅ Structured configuration data
- ✅ Data that shouldn't be cleared when browser cache is cleared
- ✅ Large datasets that don't fit in localStorage

#### When NOT to Use:
- ❌ Highly sensitive data without encryption
- ❌ Data that needs real-time synchronous updates in renderer
- ❌ Temporary session data

#### Storage Locations:
- **macOS:** `~/Library/Application Support/marketmind/`
- **Windows:** `%APPDATA%/marketmind/`
- **Linux:** `~/.config/marketmind/`

**Files:**
- `src/main/services/StorageService.ts` - Main implementation
- Stores: `marketmind-secure.json`

---

### 3. **safeStorage** (Electron SafeStorage API)
**Location:** OS keychain/credential manager  
**Encryption:** ✅ Yes (OS-level encryption)  
**Persistence:** ✅ Yes (secure storage)  
**Access:** Main process only  
**Size Limit:** Small data only (designed for credentials)  

#### When to Use:
- ✅ **API keys** (OpenAI, Anthropic, Gemini, NewsAPI, CryptoPanic)
- ✅ Authentication tokens
- ✅ OAuth secrets
- ✅ Any sensitive credentials
- ✅ Data that requires OS-level encryption

#### When NOT to Use:
- ❌ Large data
- ❌ Frequently changing data
- ❌ Non-sensitive data (overhead not needed)
- ❌ Data that needs to be portable

#### How It Works:
1. Data is encrypted using OS-level APIs:
   - **macOS:** Keychain
   - **Windows:** DPAPI (Data Protection API)
   - **Linux:** libsecret
2. Encrypted data is stored in electron-store
3. Only the current OS user can decrypt

#### Current Usage in Project:
```typescript
// StorageService - combines electron-store + safeStorage
storageService.setApiKey('openai', 'sk-...');  // Encrypted with safeStorage
const key = storageService.getApiKey('openai'); // Decrypted
```

**Files:**
- `src/main/services/StorageService.ts` - Encryption wrapper
- `src/renderer/hooks/useSecureStorage.ts` - React hook (via IPC)

---

### 4. **Zustand Store** (In-Memory State)
**Location:** JavaScript memory  
**Encryption:** ❌ No  
**Persistence:** ❌ No (lost on reload)  
**Access:** Renderer process  
**Size Limit:** RAM limit  

#### When to Use:
- ✅ Application state (current conversation, UI state)
- ✅ Data that changes frequently
- ✅ Computed/derived state
- ✅ State that needs to be shared across components
- ✅ State with complex update logic

#### When NOT to Use:
- ❌ Data that needs to persist across sessions
- ❌ Large datasets that should be saved
- ❌ Configuration that users expect to save

#### Current Usage in Project:
```typescript
// AI Store
const { conversations, currentConversation, addMessage } = useAIStore();
```

**Files:**
- `src/renderer/store/aiStore.ts` - AI conversations state
- `src/renderer/store/index.ts` - Store exports

---

## Decision Matrix

| Data Type | Storage Solution | Reason |
|-----------|-----------------|--------|
| API Keys | safeStorage + electron-store | Sensitive, needs encryption |
| User Preferences (theme, etc) | localStorage | Fast access, non-sensitive |
| Chart Settings | localStorage | Frequently accessed, non-sensitive |
| AI Conversations | Zustand + localStorage (persist) | Complex state, optional save |
| App Configuration | electron-store | Persistent, app-level settings |
| News Settings | **Should use:** electron-store | Persistent, contains API keys |
| Session Token | safeStorage | Sensitive, temporary |
| Cache Data | localStorage or In-Memory | Temporary, fast access |

---

## Recommended Pattern for News Configuration

Based on the evaluation, news settings should use a **hybrid approach**:

### ✅ Recommended Implementation:

```typescript
// News Settings Storage Strategy:

1. API Keys → safeStorage (encrypted)
   - newsApiKey
   - cryptoPanicApiKey

2. Non-sensitive settings → electron-store
   - enabled (boolean)
   - refreshInterval (number)
   - maxArticles (number)
   - preferredProvider (string)

3. UI state → localStorage
   - lastFetchTime (for cache)
   - selectedFilters (temporary)
```

### Implementation Steps:

1. **Extend StorageService** to support news API keys:
```typescript
// Add to StorageService.ts
setNewsApiKey(provider: 'newsapi' | 'cryptopanic', apiKey: string): void
getNewsApiKey(provider: 'newsapi' | 'cryptopanic'): string | null
```

2. **Add news settings to electron-store schema**:
```typescript
interface SecureStoreSchema {
  apiKeys: {...};
  newsSettings?: {
    enabled: boolean;
    refreshInterval: number;
    maxArticles: number;
  };
}
```

3. **Use in NewsConfigTab**:
```typescript
// Get from secure storage via IPC
const newsApiKey = await window.electron.secureStorage.getNewsApiKey('newsapi');

// Get non-sensitive settings from electron-store
const settings = await window.electron.store.get('newsSettings');
```

---

## Security Best Practices

### ✅ DO:
- Store API keys in safeStorage
- Use electron-store for persistent non-sensitive data
- Use localStorage for UI preferences
- Validate data before storage
- Handle encryption errors gracefully

### ❌ DON'T:
- Store API keys in localStorage (visible in DevTools)
- Store sensitive data without encryption
- Store large files in localStorage
- Assume safeStorage is available (check first)
- Mix concerns (use right tool for each job)

---

## Migration Guide

If you need to migrate existing data:

```typescript
// Example: Migrate from localStorage to electron-store
const migrateNewsSettings = async () => {
  // 1. Read from localStorage
  const oldKey = localStorage.getItem('news_api_key');
  
  // 2. Save to secure storage
  if (oldKey) {
    await window.electron.secureStorage.setNewsApiKey('newsapi', oldKey);
  }
  
  // 3. Remove from localStorage
  localStorage.removeItem('news_api_key');
};
```

---

## Conclusion

**For News Configuration specifically:**

| Setting | Storage | Reason |
|---------|---------|--------|
| newsApiKey | safeStorage | Sensitive credential |
| cryptoPanicApiKey | safeStorage | Sensitive credential |
| enabled | electron-store | Persistent preference |
| refreshInterval | electron-store | Persistent setting |
| maxArticles | electron-store | Persistent setting |
| lastFetchTime | localStorage | Temporary cache data |
| testResults | In-Memory | Temporary UI state |

This ensures:
- 🔒 Security: API keys are encrypted
- 💾 Persistence: Settings survive app restarts
- ⚡ Performance: Fast access for UI state
- 🎯 Separation: Right tool for each purpose
