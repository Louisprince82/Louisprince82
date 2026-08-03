/** Tiny TTL cache. In production this is Redis (spec §3); the interface is
 *  deliberately Redis-shaped so the swap is a one-file change. */
export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlMs: number, private readonly maxEntries = 5_000) {}

  get(key: string): T | undefined {
    const e = this.entries.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key: string, value: T): void {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  async getOrFetch(key: string, fetcher: () => Promise<T>): Promise<T> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const value = await fetcher();
    this.set(key, value);
    return value;
  }
}
