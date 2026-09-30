import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const BACKEND_HEALTH_SERVICE = 'marketmind-backend';

export interface BackendRuntimeInfo {
  service: typeof BACKEND_HEALTH_SERVICE;
  url: string;
  port: number;
  pid: number;
  startedAt: string;
}

export const readBackendRuntime = (filePath: string): BackendRuntimeInfo | null => {
  try {
    const info = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<BackendRuntimeInfo>;
    if (info.service !== BACKEND_HEALTH_SERVICE || typeof info.url !== 'string' || typeof info.port !== 'number') return null;
    return info as BackendRuntimeInfo;
  } catch {
    return null;
  }
};

export const writeBackendRuntime = (filePath: string, port: number): BackendRuntimeInfo => {
  const info: BackendRuntimeInfo = {
    service: BACKEND_HEALTH_SERVICE,
    url: `http://localhost:${port}`,
    port,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(info, null, 2)}\n`);
  return info;
};

export const removeBackendRuntime = (filePath: string): void => {
  const current = readBackendRuntime(filePath);
  if (current && current.pid !== process.pid) return;
  rmSync(filePath, { force: true });
};
