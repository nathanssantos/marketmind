const envBackendUrl = import.meta.env['VITE_BACKEND_URL'];
const bridgeBackendUrl = typeof window !== 'undefined' ? window.electron?.backend?.url : null;
const DEFAULT_BACKEND_URL = 'http://localhost:3001';

const devServerBackendUrl = typeof window !== 'undefined' ? window.__MM_BACKEND_URL__ : undefined;

export const BACKEND_URL = typeof envBackendUrl === 'string' ? envBackendUrl : (bridgeBackendUrl ?? devServerBackendUrl ?? DEFAULT_BACKEND_URL);
export const BACKEND_WS_URL = BACKEND_URL.replace('http', 'ws');
export const BACKEND_TRPC_URL = `${BACKEND_URL}/trpc`;
