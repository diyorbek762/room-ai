import { getAllTierUrls, type ModelQuality } from "./modelUrl";
import { runConcurrent } from "./modelLoader";

const CACHE_NAME = "roomai-models-v4";
const PREWARM_CONCURRENCY = 4;
const PREWARM_RETRY_DELAYS = [1000, 2000, 4000];

// Pre-warm only the low tier (1.1 MB total) on app load — enough to place any
// item with visible geometry instantly. Higher tiers are fetched on demand
// after placement when bandwidth allows.
const PREWARM_ENTRIES = getAllTierUrls().filter((e) => e.quality === "low");

let cachingStarted = false;
let cacheProgress = 0;
let cacheFailed = 0;
const cacheTotal = PREWARM_ENTRIES.length;

export function startPreCaching(): void {
  if (cachingStarted) return;
  cachingStarted = true;

  if (!("caches" in window) || typeof fetch === "undefined") return;

  void (async () => {
    const cache = await caches.open(CACHE_NAME);
    const result = await runConcurrent(PREWARM_ENTRIES, PREWARM_CONCURRENCY, async (entry) => {
      await cacheOneWithRetry(cache, entry.url);
    });
    cacheFailed = result.failed;
  })();
}

async function cacheOneWithRetry(cache: Cache, url: string): Promise<void> {
  for (let attempt = 0; attempt <= PREWARM_RETRY_DELAYS.length; attempt++) {
    try {
      const existing = await cache.match(url);
      if (existing) {
        cacheProgress++;
        return;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await cache.put(url, response.clone());
      cacheProgress++;
      return;
    } catch {
      if (attempt === PREWARM_RETRY_DELAYS.length) {
        cacheProgress++;
        throw new Error(`failed to cache ${url} after ${attempt + 1} attempts`);
      }
      await new Promise((r) => setTimeout(r, PREWARM_RETRY_DELAYS[attempt]));
    }
  }
}

export function getCacheProgress(): { done: number; total: number; pct: number; failed: number } {
  return {
    done: cacheProgress,
    total: cacheTotal,
    failed: cacheFailed,
    pct: cacheTotal === 0 ? 100 : Math.round((cacheProgress / cacheTotal) * 100),
  };
}

export async function getCachedModel(url: string): Promise<ArrayBuffer | null> {
  if (!("caches" in window)) return null;

  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(url);
    if (response) {
      return await response.arrayBuffer();
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Manually add a model URL to the cache (e.g. when a high-tier upgrade is
 * requested after placement). Uses the same retry policy as the pre-warm.
 */
export async function cacheModel(url: string): Promise<boolean> {
  if (!("caches" in window)) return false;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cacheOneWithRetry(cache, url);
    return true;
  } catch {
    return false;
  }
}

