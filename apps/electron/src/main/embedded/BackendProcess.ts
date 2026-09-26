import { utilityProcess, type UtilityProcess } from 'electron';
import { createWriteStream, mkdirSync, renameSync, statSync, type WriteStream } from 'node:fs';
import path from 'node:path';
import { LOOPBACK_HOST } from './ports';

const HEALTH_POLL_INTERVAL_MS = 250;
const HEALTH_TIMEOUT_MS = 60_000;
const SHUTDOWN_GRACE_MS = 8_000;
const LOG_ROTATE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_RESTARTS = 3;
const RESTART_BACKOFF_MS = [1_000, 2_000, 4_000];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface BackendProcessOptions {
  entry: string;
  env: Record<string, string>;
  port: number;
  logFile: string;
  log: (line: string) => void;
  onUnexpectedExit?: (code: number | null, restarting: boolean) => void;
}

export class BackendProcess {
  private readonly options: BackendProcessOptions;
  private child: UtilityProcess | null = null;
  private logStream: WriteStream | null = null;
  private stopping = false;
  private restarts = 0;

  constructor(options: BackendProcessOptions) {
    this.options = options;
  }

  get url(): string {
    return `http://${LOOPBACK_HOST}:${this.options.port}`;
  }

  async start(): Promise<void> {
    this.stopping = false;
    this.openLog();
    this.spawn();
    await this.waitUntilHealthy();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    const child = this.child;
    if (!child) return;
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
    child.postMessage({ type: 'shutdown' });
    const timeout = sleep(SHUTDOWN_GRACE_MS).then(() => {
      if (this.child === child) child.kill();
    });
    await Promise.race([exited, timeout]);
    await exited;
    this.child = null;
    this.logStream?.end();
    this.logStream = null;
  }

  private spawn(): void {
    const { entry, env, log } = this.options;
    log(`backend: starting ${entry} on port ${this.options.port}`);
    const child = utilityProcess.fork(entry, [], { env, stdio: 'pipe', serviceName: 'marketmind-backend' });
    this.child = child;
    child.stdout?.on('data', (chunk: Buffer) => this.logStream?.write(chunk));
    child.stderr?.on('data', (chunk: Buffer) => this.logStream?.write(chunk));
    child.once('exit', (code) => {
      if (this.child !== child) return;
      this.child = null;
      if (this.stopping) return;
      void this.handleUnexpectedExit(code);
    });
  }

  private async handleUnexpectedExit(code: number | null): Promise<void> {
    const canRestart = this.restarts < MAX_RESTARTS;
    this.options.log(`backend: exited unexpectedly with code ${String(code)}${canRestart ? ', restarting' : ', giving up'}`);
    this.options.onUnexpectedExit?.(code, canRestart);
    if (!canRestart) return;
    await sleep(RESTART_BACKOFF_MS[this.restarts] ?? RESTART_BACKOFF_MS[RESTART_BACKOFF_MS.length - 1] ?? 0);
    this.restarts += 1;
    if (this.stopping) return;
    this.spawn();
  }

  private openLog(): void {
    const { logFile } = this.options;
    mkdirSync(path.dirname(logFile), { recursive: true });
    try {
      if (statSync(logFile).size > LOG_ROTATE_BYTES) renameSync(logFile, `${logFile}.1`);
    } catch {
      return void (this.logStream = createWriteStream(logFile, { flags: 'a' }));
    }
    this.logStream = createWriteStream(logFile, { flags: 'a' });
  }

  private async waitUntilHealthy(): Promise<void> {
    const deadline = Date.now() + HEALTH_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (!this.child) throw new Error('The backend exited before it became healthy. See the backend log.');
      try {
        const response = await fetch(`${this.url}/health`);
        if (response.ok) return;
      } catch {
        await sleep(HEALTH_POLL_INTERVAL_MS);
        continue;
      }
      await sleep(HEALTH_POLL_INTERVAL_MS);
    }
    throw new Error(`The backend did not answer on ${this.url}/health within ${HEALTH_TIMEOUT_MS / 1000}s.`);
  }
}
