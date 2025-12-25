import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import { ColorModeProvider } from './components/ui/color-mode';
import './global.d.ts';
import './i18n';
import { ChartWindow } from './pages/ChartWindow';

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
        background: #1a1a2e;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        padding: 20px;
        text-align: center;
      ">
        <h1 style="color: #ff6b6b; margin-bottom: 16px;">Something went wrong</h1>
        <p style="color: #a0a0a0; margin-bottom: 24px; max-width: 500px;">
          The application encountered an unexpected error. This might be due to a temporary issue.
        </p>
        <pre style="
          background: #0d0d1a;
          padding: 16px;
          border-radius: 8px;
          max-width: 600px;
          overflow: auto;
          font-size: 12px;
          color: #ff6b6b;
          margin-bottom: 24px;
          text-align: left;
        ">${typeof error === 'string' ? error : error.message}</pre>
        <button onclick="window.location.reload()" style="
          background: #4a90d9;
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

try {
  const root = createRoot(rootElement);

  root.render(
    <ColorModeProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/chart" element={<ChartWindow />} />
          <Route path="/chart/:symbol" element={<ChartWindow />} />
          <Route path="/chart/:symbol/:timeframe" element={<ChartWindow />} />
        </Routes>
      </HashRouter>
    </ColorModeProvider>
  );
} catch (error) {
  console.error('[Fatal Render Error]', error);
  showFatalErrorScreen(error instanceof Error ? error : new Error(String(error)));
}
