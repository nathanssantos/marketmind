type ReleaseFn = () => void;

class WalletLockService {
  private locks = new Map<string, Promise<void>>();
  private resolvers = new Map<string, ReleaseFn>();

  async acquire(walletId: string): Promise<ReleaseFn> {
    while (this.locks.has(walletId)) {
      await this.locks.get(walletId);
    }

    let release: ReleaseFn;
    const lockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.locks.set(walletId, lockPromise);
    this.resolvers.set(walletId, release!);

    return () => {
      this.locks.delete(walletId);
      this.resolvers.delete(walletId);
      release!();
    };
  }

  isLocked(walletId: string): boolean {
    return this.locks.has(walletId);
  }
}

export const walletLockService = new WalletLockService();
