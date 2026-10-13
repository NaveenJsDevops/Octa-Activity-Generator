/**
 * Module-level cache for infrequently-changing API data.
 *
 * Features:
 * - TTL-based cache (5 minutes) — only fetches once per session
 * - In-flight deduplication — concurrent calls share one pending Promise
 * - Error isolation — a failed AI call does not affect topic/other calls
 */

const API_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
    : "http://localhost:8000";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE = new Map<string, CacheEntry<unknown>>();
// In-flight promise deduplication — prevents double-fetch on concurrent calls
const IN_FLIGHT = new Map<string, Promise<unknown>>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

async function cachedFetch<T>(key: string, url: string): Promise<T> {
  const now = Date.now();

  // Return cached value if still fresh
  const entry = CACHE.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > now) {
    return entry.data;
  }

  // If a fetch for this key is already in flight, reuse that promise
  if (IN_FLIGHT.has(key)) {
    return IN_FLIGHT.get(key) as Promise<T>;
  }

  // Start a new fetch and register it as in-flight
  const promise = fetch(url)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      const data: T = await res.json();
      CACHE.set(key, { data, expiresAt: Date.now() + TTL_MS });
      return data;
    })
    .finally(() => {
      IN_FLIGHT.delete(key);
    });

  IN_FLIGHT.set(key, promise);
  return promise as Promise<T>;
}

/** Force a fresh fetch next time (e.g., after a user-initiated change). */
export function invalidateCache(key: string) {
  CACHE.delete(key);
  IN_FLIGHT.delete(key);
}

// ─── Typed helpers ───────────────────────────────────────────────────────────

export interface HealthData {
  status: string;
  ai?: { configured: boolean };
}

export interface AiSettings {
  model: string;
  provider: string;
  temperature: number;
  max_tokens: number;
}

/** Health endpoint — used only to determine if AI is configured. */
export function fetchHealth(): Promise<HealthData> {
  return cachedFetch<HealthData>("health", `${API_URL}/api/health`);
}

/** AI settings — model name, provider, etc. */
export function fetchAiSettings(): Promise<AiSettings> {
  return cachedFetch<AiSettings>("ai_settings", `${API_URL}/api/settings/ai`);
}

/** Available model list for the model switcher. */
export function fetchAiModels(): Promise<{ models: string[] }> {
  return cachedFetch<{ models: string[] }>("ai_models", `${API_URL}/api/settings/ai/models`);
}
