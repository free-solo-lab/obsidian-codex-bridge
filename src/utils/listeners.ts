/** A typed subscribe/notify set, shared by the RPC client and the bridge service. */
export class Listeners<T> {
  private readonly listeners = new Set<(value: T) => void>();

  subscribe(listener: (value: T) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify(value: T): void {
    for (const listener of this.listeners) listener(value);
  }
}
