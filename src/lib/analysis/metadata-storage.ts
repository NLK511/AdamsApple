/**
 * In-memory metadata cache with refresh policies and history snapshots.
 * Stores inferred ticker analytics while leaving volatile pricing uncached.
 */
export interface CacheRecord<T> {
  key: string;
  value: T;
  computedAt: number;
}

export interface CacheHistoryRecord<T> extends CacheRecord<T> {
  version: number;
}

interface TickerState {
  latest: Map<string, CacheRecord<unknown>>;
  history: Map<string, CacheHistoryRecord<unknown>[]>;
  intervals: Map<string, number>;
}

export class InMemoryTickerMetadataStorage {
  private globalIntervalMs: number;
  private tickers = new Map<string, TickerState>();

  constructor(globalIntervalMs = 15 * 60 * 1000) {
    this.globalIntervalMs = globalIntervalMs;
  }

  setGlobalRefreshInterval(intervalMs: number) {
    this.globalIntervalMs = Math.max(1000, intervalMs);
  }

  getGlobalRefreshInterval() {
    return this.globalIntervalMs;
  }

  setTickerRefreshInterval(symbol: string, key: string, intervalMs: number) {
    const state = this.ensureTickerState(symbol);
    state.intervals.set(key, Math.max(1000, intervalMs));
  }

  getRefreshInterval(symbol: string, key: string) {
    const state = this.ensureTickerState(symbol);
    return state.intervals.get(key) ?? this.globalIntervalMs;
  }

  private ensureTickerState(symbol: string) {
    const normalized = symbol.toUpperCase();
    if (!this.tickers.has(normalized)) {
      this.tickers.set(normalized, {
        latest: new Map(),
        history: new Map(),
        intervals: new Map()
      });
    }
    return this.tickers.get(normalized)!;
  }

  getLatest<T>(symbol: string, key: string): CacheRecord<T> | null {
    const state = this.ensureTickerState(symbol);
    return (state.latest.get(key) as CacheRecord<T> | undefined) ?? null;
  }

  getHistory<T>(symbol: string, key: string): CacheHistoryRecord<T>[] {
    const state = this.ensureTickerState(symbol);
    return ((state.history.get(key) as CacheHistoryRecord<T>[]) ?? []).slice();
  }

  shouldRefresh(symbol: string, key: string, now = Date.now()) {
    const latest = this.getLatest(symbol, key);
    if (!latest) return true;
    return now - latest.computedAt >= this.getRefreshInterval(symbol, key);
  }

  upsert<T>(symbol: string, key: string, value: T, computedAt = Date.now()): CacheRecord<T> {
    const state = this.ensureTickerState(symbol);
    const latest: CacheRecord<T> = { key, value, computedAt };
    state.latest.set(key, latest);

    const history = ((state.history.get(key) as CacheHistoryRecord<T>[]) ?? []).slice();
    history.push({ ...latest, version: history.length + 1 });
    state.history.set(key, history.slice(-200));

    return latest;
  }

  getOrCompute<T>(symbol: string, key: string, compute: () => T, now = Date.now()): CacheRecord<T> {
    if (!this.shouldRefresh(symbol, key, now)) {
      return this.getLatest(symbol, key)!;
    }
    return this.upsert(symbol, key, compute(), now);
  }

  async getOrComputeAsync<T>(symbol: string, key: string, compute: () => Promise<T>, now = Date.now()): Promise<CacheRecord<T>> {
    if (!this.shouldRefresh(symbol, key, now)) {
      return this.getLatest(symbol, key)!;
    }
    return this.upsert(symbol, key, await compute(), now);
  }

  dump() {
    const entries = [...this.tickers.entries()].map(([symbol, state]) => ({
      symbol,
      globalIntervalMs: this.globalIntervalMs,
      intervals: Object.fromEntries(state.intervals.entries()),
      latest: Object.fromEntries(
        [...state.latest.entries()].map(([key, value]) => [key, value])
      ),
      history: Object.fromEntries(
        [...state.history.entries()].map(([key, value]) => [key, value])
      )
    }));

    return { tickers: entries };
  }
}
