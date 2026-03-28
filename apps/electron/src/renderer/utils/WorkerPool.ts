type WorkerFactory = () => Worker;

let nextRequestId = 0;
export const getNextRequestId = (): number => ++nextRequestId;

class WorkerPool {
  private workers: Map<string, Worker> = new Map();
  private factories: Map<string, WorkerFactory> = new Map();

  register(key: string, factory: WorkerFactory): void {
    this.factories.set(key, factory);
  }

  get(key: string): Worker | null {
    if (this.workers.has(key)) {
      return this.workers.get(key)!;
    }

    const factory = this.factories.get(key);
    if (!factory) return null;

    const worker = factory();
    this.workers.set(key, worker);
    return worker;
  }

  terminate(key: string): void {
    const worker = this.workers.get(key);
    if (worker) {
      worker.terminate();
      this.workers.delete(key);
    }
  }

  terminateAll(): void {
    this.workers.forEach(worker => worker.terminate());
    this.workers.clear();
  }

  has(key: string): boolean {
    return this.workers.has(key);
  }
}

export const workerPool = new WorkerPool();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    workerPool.terminateAll();
  });
}
