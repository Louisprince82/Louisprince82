import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/** Durable key-value store backed by a JSON file with atomic writes
 *  (write-to-temp + rename, so a crash never corrupts the data file).
 *  This is the Phase-1 persistence layer; production swaps it for Postgres
 *  behind the same repository interfaces. */
export class JsonStore<T> {
  private map = new Map<string, T>();
  private loaded = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.map = new Map(Object.entries(JSON.parse(raw) as Record<string, T>));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    this.loaded = true;
  }

  private ensureLoaded(): void {
    if (!this.loaded) throw new Error(`JsonStore(${this.filePath}) used before load()`);
  }

  get(id: string): T | undefined {
    this.ensureLoaded();
    return this.map.get(id);
  }

  values(): T[] {
    this.ensureLoaded();
    return [...this.map.values()];
  }

  find(predicate: (item: T) => boolean): T | undefined {
    return this.values().find(predicate);
  }

  get size(): number {
    this.ensureLoaded();
    return this.map.size;
  }

  async set(id: string, value: T): Promise<void> {
    this.ensureLoaded();
    this.map.set(id, value);
    await this.persist();
  }

  async delete(id: string): Promise<boolean> {
    this.ensureLoaded();
    const existed = this.map.delete(id);
    if (existed) await this.persist();
    return existed;
  }

  /** Serialized so concurrent writes never interleave on the same file. */
  private persist(): Promise<void> {
    const snapshot = JSON.stringify(Object.fromEntries(this.map), null, 2);
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      await writeFile(tmp, snapshot, "utf8");
      await rename(tmp, this.filePath);
    });
    return this.writeChain;
  }
}
