import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BACKEND_HEALTH_SERVICE, readBackendRuntime, removeBackendRuntime, writeBackendRuntime } from '../../server/runtime-file';

describe('backend runtime file', () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'mm-runtime-'));
    filePath = path.join(dir, '.runtime', 'backend.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('records the bound port and reads it back', () => {
    writeBackendRuntime(filePath, 3007);
    expect(readBackendRuntime(filePath)).toMatchObject({ service: BACKEND_HEALTH_SERVICE, url: 'http://localhost:3007', port: 3007, pid: process.pid });
  });

  it('ignores missing or foreign files', () => {
    expect(readBackendRuntime(filePath)).toBeNull();
    writeFileSync(path.join(dir, 'other.json'), JSON.stringify({ service: 'something-else', url: 'http://localhost:1', port: 1 }));
    expect(readBackendRuntime(path.join(dir, 'other.json'))).toBeNull();
  });

  it('removes the file it wrote but leaves one written by another process', () => {
    writeBackendRuntime(filePath, 3007);
    removeBackendRuntime(filePath);
    expect(existsSync(filePath)).toBe(false);

    writeBackendRuntime(filePath, 3008);
    writeFileSync(filePath, JSON.stringify({ ...readBackendRuntime(filePath), pid: process.pid + 1 }));
    removeBackendRuntime(filePath);
    expect(existsSync(filePath)).toBe(true);
  });
});
