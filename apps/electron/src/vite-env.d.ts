
interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY?: string;
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_DEBUG_MODE?: string;
  readonly VITE_DEBUG_SETUPS?: string;
  readonly VITE_API_TIMEOUT?: string;
  readonly VITE_NEWSAPI_API_KEY?: string;
  readonly VITE_CRYPTOPANIC_API_KEY?: string;
  readonly DEV?: boolean;
  readonly [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly hot?: {
    accept: (cb?: () => void) => void;
    dispose: (cb: (data: unknown) => void) => void;
  };
}
