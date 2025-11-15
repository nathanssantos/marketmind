import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ColorModeProvider } from './components/ui/color-mode';
import './global.d.ts';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <ColorModeProvider>
      <App />
    </ColorModeProvider>
  </StrictMode>
);
