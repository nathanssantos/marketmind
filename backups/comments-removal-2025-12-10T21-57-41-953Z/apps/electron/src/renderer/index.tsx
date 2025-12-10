import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import { ColorModeProvider } from './components/ui/color-mode';
import './global.d.ts';
import './i18n';
import { ChartWindow } from './pages/ChartWindow';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <ColorModeProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/chart" element={<ChartWindow />} />
          <Route path="/chart/:symbol" element={<ChartWindow />} />
        </Routes>
      </HashRouter>
    </ColorModeProvider>
  </StrictMode>
);
