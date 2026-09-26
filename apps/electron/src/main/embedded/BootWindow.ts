import { BrowserWindow } from 'electron';

export type BootStatus = 'database' | 'backend' | 'ready';

type BootLanguage = 'en' | 'pt' | 'es' | 'fr';

const STATUS_TEXT: Record<BootLanguage, Record<BootStatus, string>> = {
  en: { database: 'Starting the database…', backend: 'Starting the trading engine…', ready: 'Opening MarketMind…' },
  pt: { database: 'Iniciando o banco de dados…', backend: 'Iniciando o motor de trading…', ready: 'Abrindo o MarketMind…' },
  es: { database: 'Iniciando la base de datos…', backend: 'Iniciando el motor de trading…', ready: 'Abriendo MarketMind…' },
  fr: { database: 'Démarrage de la base de données…', backend: 'Démarrage du moteur de trading…', ready: 'Ouverture de MarketMind…' },
};

const WINDOW_SIZE = { width: 440, height: 260 } as const;

const bootLanguage = (locale: string): BootLanguage => {
  const language = locale.slice(0, 2).toLowerCase();
  return language === 'pt' || language === 'es' || language === 'fr' ? language : 'en';
};

const pageHtml = (initialText: string): string => `<!doctype html>
<html><head><meta charset="utf-8"><title>MarketMind</title>
<style>
  html, body { margin: 0; height: 100%; background: #0d1117; color: #e6edf3; font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; -webkit-app-region: drag; user-select: none; }
  h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
  p { margin: 0; color: #8b949e; }
  .bar { width: 200px; height: 3px; background: #21262d; border-radius: 2px; overflow: hidden; }
  .bar::after { content: ""; display: block; width: 40%; height: 100%; background: #3b82f6; animation: slide 1.2s ease-in-out infinite; }
  @keyframes slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
</style></head>
<body><h1>MarketMind</h1><div class="bar"></div><p id="status">${initialText}</p></body></html>`;

export class BootWindow {
  private readonly window: BrowserWindow;
  private readonly texts: Record<BootStatus, string>;

  constructor(locale: string) {
    this.texts = STATUS_TEXT[bootLanguage(locale)];
    this.window = new BrowserWindow({
      ...WINDOW_SIZE,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      frame: false,
      show: false,
      backgroundColor: '#0d1117',
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    this.window.once('ready-to-show', () => this.window.show());
    void this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(pageHtml(this.texts.database))}`);
  }

  setStatus(status: BootStatus): void {
    if (this.window.isDestroyed()) return;
    void this.window.webContents.executeJavaScript(
      `document.getElementById('status').textContent = ${JSON.stringify(this.texts[status])};`,
    );
  }

  close(): void {
    if (!this.window.isDestroyed()) this.window.close();
  }
}
