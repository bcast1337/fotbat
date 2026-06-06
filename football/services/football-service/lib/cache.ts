/**
 * Lightweight in-memory TTL cache.
 *
 * Used to avoid duplicate API calls and respect the API-Football rate limits.
 * Each entry stores a value and an expiry timestamp; expired entries are
 * lazily evicted on read.
 */
type Entry<T> = { value: T; expires: number };

export class TtlCache {
  private store = new Map<string, Entry<unknown>>();

  /**
   * Read a value if present and not expired.
   * @param key - cache key.
   * @returns the cached value or undefined.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  /**
   * Store a value with a time-to-live.
   * @param key - cache key.
   * @param value - value to store.
   * @param ttlMs - time-to-live in milliseconds.
   */
  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expires: Date.now() + ttlMs });
  }

  /**
   * Get a cached value or compute, store, and return it.
   * @param key - cache key.
   * @param ttlMs - time-to-live in milliseconds.
   * @param fn - async producer invoked on cache miss.
   * @returns the cached or freshly computed value.
   */
  async wrap<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await fn();
    this.set(key, value, ttlMs);
    return value;
  }
}

/** Shared singleton cache for the service. */
export const cache = new TtlCache();
