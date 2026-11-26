/** localStorage wrappers: storage can be blocked (private mode), so failures are logged, never fatal. */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (err) {
    console.warn(`[storage] read failed key=${key}`, err);
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[storage] write failed key=${key}`, err);
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[storage] remove failed key=${key}`, err);
  }
}
