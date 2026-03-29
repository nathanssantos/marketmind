import { ChakraProvider } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';
import { createPlatformAdapter } from './adapters/factory';
import type { PlatformAdapter } from './adapters/types';
import App from './App';
import { AuthGuard } from './components/Auth/AuthGuard';
import { LanguageSyncProvider } from './components/LanguageSyncProvider';
import { TrpcProvider } from './components/TrpcProvider';
import { ColorModeProvider } from './components/ui';
import { PRE_REACT_COLORS } from './constants/preReactColors';
import { PlatformProvider } from './context/PlatformContext';
import './global.d.ts';
import './i18n';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { TwoFactorPage } from './pages/TwoFactorPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ChartWindow } from './pages/ChartWindow';
import { system } from './theme';

const PERFORMANCE_CLEANUP = {
  INTERVAL_MS: 30_000,
  MAX_ENTRIES: 1000,
} as const;

const setupPerformanceCleanup = (): (() => void) => {
  const cleanup = () => {
    try {
      const entries = performance.getEntries();
      if (entries.length > PERFORMANCE_CLEANUP.MAX_ENTRIES) {
        performance.clearMarks();
        performance.clearMeasures();
        performance.clearResourceTimings();
      }
    } catch {
      // Ignore errors during cleanup
    }
  };

  const intervalId = setInterval(cleanup, PERFORMANCE_CLEANUP.INTERVAL_MS);
  return () => clearInterval(intervalId);
};

const cleanupPerformance = setupPerformanceCleanup();

const RouterComponent = ({ platform, children }: { platform: 'electron' | 'web'; children: React.ReactNode }) => {
  if (platform === 'web') {
    return <BrowserRouter>{children}</BrowserRouter>;
  }
  return <HashRouter>{children}</HashRouter>;
};

const Root = () => {
  const [adapter, setAdapter] = useState<PlatformAdapter | null>(null);

  useEffect(() => {
    createPlatformAdapter().then(setAdapter);
  }, []);

  if (!adapter) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: PRE_REACT_COLORS.bg.loading }}>
        <div style={{ color: PRE_REACT_COLORS.fg.default, fontFamily: 'system-ui' }}>Loading...</div>
      </div>
    );
  }

  return (
    <TrpcProvider>
      <PlatformProvider adapter={adapter}>
        <ChakraProvider value={system}>
          <ColorModeProvider>
            <LanguageSyncProvider>
              <RouterComponent platform={adapter.platform}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
                  <Route path="/verify-email/:token?" element={<VerifyEmailPage />} />
                  <Route path="/two-factor" element={<TwoFactorPage />} />
                  <Route path="/" element={<AuthGuard><App /></AuthGuard>} />
                  <Route path="/chart" element={<AuthGuard><ChartWindow /></AuthGuard>} />
                  <Route path="/chart/:symbol" element={<AuthGuard><ChartWindow /></AuthGuard>} />
                  <Route path="/chart/:symbol/:timeframe" element={<AuthGuard><ChartWindow /></AuthGuard>} />
                </Routes>
              </RouterComponent>
            </LanguageSyncProvider>
          </ColorModeProvider>
        </ChakraProvider>
      </PlatformProvider>
    </TrpcProvider>
  );
};

const showFatalErrorScreen = (error: Error | string) => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: ${PRE_REACT_COLORS.bg.loading};
        color: ${PRE_REACT_COLORS.fg.default};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        padding: 20px;
        text-align: center;
      ">
        <h1 style="color: ${PRE_REACT_COLORS.fg.error}; margin-bottom: 16px;">Something went wrong</h1>
        <p style="color: ${PRE_REACT_COLORS.fg.muted}; margin-bottom: 24px; max-width: 500px;">
          The application encountered an unexpected error. This might be due to a temporary issue.
        </p>
        <pre style="
          background: ${PRE_REACT_COLORS.bg.error};
          padding: 16px;
          border-radius: 8px;
          max-width: 600px;
          overflow: auto;
          font-size: 12px;
          color: ${PRE_REACT_COLORS.fg.error};
          margin-bottom: 24px;
          text-align: left;
        ">${typeof error === 'string' ? error : error.message}</pre>
        <button onclick="window.location.reload()" style="
          background: ${PRE_REACT_COLORS.button.primary};
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
        ">Reload Application</button>
      </div>
    `;
  }
};

window.onerror = (message, source, lineno, colno, error) => {
  console.error('[Global Error]', { message, source, lineno, colno, error });
  if (error?.message?.includes('ResizeObserver')) return true;
  return false;
};

window.onunhandledrejection = (event: PromiseRejectionEvent) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
  if (event.reason?.message?.includes('ResizeObserver')) return;
  if (event.reason?.message?.includes('ETIMEDOUT')) return;
  if (event.reason?.message?.includes('ECONNRESET')) return;
};

window.addEventListener('error', (event) => {
  console.error('[Window Error Event]', event.error);
  if (event.error?.message?.includes('ResizeObserver')) {
    event.preventDefault();
    return;
  }
  if (event.error?.message?.includes('ChunkLoadError') ||
      event.error?.message?.includes('Loading chunk')) {
    console.warn('[Chunk Load Error] Attempting to reload...');
    setTimeout(() => window.location.reload(), 1000);
    return;
  }
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

window.addEventListener('beforeunload', () => {
  cleanupPerformance();
});

try {
  const root = createRoot(rootElement);
  root.render(<Root />);
} catch (error) {
  console.error('[Fatal Render Error]', error);
  showFatalErrorScreen(error instanceof Error ? error : new Error(String(error)));
}
