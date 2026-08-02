import { getCachedModel } from "./modelCache";

export interface LoadProgress {
  loaded: number;
  total: number;
}

export type LoadProgressListener = (p: LoadProgress) => void;

export interface LoadOptions {
  /** Abort the request before completion. */
  signal?: AbortSignal;
  /** Per-attempt timeout in ms (default 15000). */
  timeoutMs?: number;
  /** Retry delays in ms before each retry (default [1000, 2000, 4000]). */
  retryDelays?: number[];
  /** Receive incremental bytes/total during fetch. */
  onProgress?: LoadProgressListener;
}

export class LoadError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastStatus?: number,
    public readonly aborted = false
  ) {
    super(message);
    this.name = "LoadError";
  }
}

const DEFAULT_RETRY_DELAYS = [1000, 2000, 4000];
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Fetch a single model URL into an ArrayBuffer, with cache-first lookup,
 * exponential backoff retry, per-attempt timeout, and AbortSignal support.
 *
 * Returns the raw bytes (ArrayBuffer) — caller is responsible for parsing.
 */
export async function loadModel(
  url: string,
  options: LoadOptions = {}
): Promise<ArrayBuffer> {
  const {
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryDelays = DEFAULT_RETRY_DELAYS,
    onProgress,
  } = options;

  // Cache short-circuit — no retry, no timeout, no progress (it's already on disk).
  const cached = await getCachedModel(url);
  if (cached) {
    onProgress?.({ loaded: cached.byteLength, total: cached.byteLength });
    return cached;
  }

  let lastError: unknown = null;
  let lastStatus: number | undefined;

  // First attempt + retries
  const attempts = 1 + retryDelays.length;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (signal?.aborted) {
      throw new LoadError("aborted", attempt, lastStatus, true);
    }
    try {
      return await fetchOnce(url, { signal, timeoutMs, onProgress });
    } catch (err) {
      lastError = err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new LoadError("aborted", attempt + 1, lastStatus, true);
      }
      if (err instanceof HttpError) lastStatus = err.status;
      // No more retries?
      if (attempt === attempts - 1) break;
      // Wait with backoff (skip if aborted during the wait)
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, retryDelays[attempt]);
        signal?.addEventListener("abort", () => {
          clearTimeout(t);
          resolve();
        });
      });
      if (signal?.aborted) {
        throw new LoadError("aborted", attempt + 1, lastStatus, true);
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : "load failed";
  throw new LoadError(message, attempts, lastStatus);
}

class HttpError extends Error {
  constructor(public readonly status: number, msg: string) {
    super(msg);
    this.name = "HttpError";
  }
}

async function fetchOnce(
  url: string,
  {
    signal,
    timeoutMs,
    onProgress,
  }: { signal?: AbortSignal; timeoutMs: number; onProgress?: LoadProgressListener }
): Promise<ArrayBuffer> {
  const ctrl = new AbortController();
  // Bridge the caller's signal into our internal controller
  const onCallerAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener("abort", onCallerAbort, { once: true });
  }
  // Per-attempt timeout
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: ctrl.signal });
    if (!response.ok) {
      throw new HttpError(response.status, `HTTP ${response.status} for ${url}`);
    }
    const totalHeader = response.headers.get("content-length");
    const total = totalHeader ? parseInt(totalHeader, 10) : 0;

    if (!response.body) {
      // Older browsers / non-streaming fallback
      const buf = await response.arrayBuffer();
      onProgress?.({ loaded: buf.byteLength, total: buf.byteLength });
      return buf;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loaded += value.byteLength;
        onProgress?.({ loaded, total: total || loaded });
      }
    }
    // Concatenate chunks
    const out = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    onProgress?.({ loaded, total: total || loaded });
    return out.buffer;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onCallerAbort);
  }
}

/**
 * Bounded-concurrency runner for an array of async tasks. Returns results
 * in the same order as the input. Failures are reported as the thrown error
 * from the task (no automatic retry here — caller decides).
 */
export async function runConcurrent<T>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>
): Promise<{ ok: number; failed: number; errors: unknown[] }> {
  let nextIndex = 0;
  let ok = 0;
  let failed = 0;
  const errors: unknown[] = [];

  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      try {
        await task(items[i], i);
        ok++;
      } catch (e) {
        failed++;
        errors.push(e);
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
  return { ok, failed, errors };
}
