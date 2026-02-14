// In-memory store for OAuth temporary tokens
// In production, use Redis with TTL

const store = new Map<string, { value: string; expiresAt: number }>();

export function setOAuthTemp(key: string, value: string, ttlMs: number = 600_000): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function getOAuthTemp(key: string): string | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  store.delete(key); // One-time use
  return entry.value;
}
