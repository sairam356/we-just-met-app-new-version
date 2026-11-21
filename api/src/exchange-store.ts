export type XchgValue = { userId: string; eventId?: string; eventName?: string; placeLabel?: string | null; startsOn?: string | null };

type Entry<T> = { value: T; expiresAt: number };

/** In-memory TTL store standing in for Redis in this POC. */
export class TtlStore<T> {
  private map = new Map<string, Entry<T>>();
  set(key: string, value: T, ttlSec: number) {
    this.map.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  }
  get(key: string): T | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.expiresAt < Date.now()) { this.map.delete(key); return undefined; }
    return e.value;
  }
  delete(key: string) { this.map.delete(key); }
}
