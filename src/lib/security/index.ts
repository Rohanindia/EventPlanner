/**
 * Security utilities: input sanitization, rate limiting, prompt injection guards.
 * All functions are pure and side-effect free.
 */

// ===== Input Sanitization =====

/** Strip control characters (except newline/tab) and dangerous delimiter tokens. */
export function stripControlChars(input: string): string {
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/** Escape AI delimiter tokens to prevent prompt injection. */
function escapeDelimiters(input: string): string {
  return input
    .replace(/```/g, "\\`\\`\\`")
    .replace(/###/g, "\\#\\#\\#")
    .replace(/<\|/g, "&lt;|")
    .replace(/\|>/g, "|&gt;")
    .replace(/\[INST\]/gi, "[INST_ESCAPED]")
    .replace(/\[\/INST\]/gi, "[/INST_ESCAPED]")
    .replace(/<<SYS>>/gi, "<<SYS_ESCAPED>>")
    .replace(/<\/SYS>/gi, "</SYS_ESCAPED>");
}

/**
 * Sanitize a user text input: strip control chars, trim, cap length, escape delimiters.
 */
export function sanitizeInput(input: string, maxLength: number = 500): string {
  return escapeDelimiters(stripControlChars(input.trim())).slice(0, maxLength);
}

// ===== CSV Injection Guard =====

/**
 * Guard a CSV cell value against formula injection.
 * Prefix dangerous characters (=, +, -, @, |, %) with a tab.
 */
export function guardCsvCell(value: string): string {
  const dangerous = /^[=+\-@|%]/;
  if (dangerous.test(value)) {
    return `\t${value}`;
  }
  return value;
}

// ===== Rate Limiter (Token Bucket) =====

interface BucketEntry {
  tokens: number;
  lastRefill: number;
}

interface RateLimiterConfig {
  /** Max tokens in the bucket */
  capacity: number;
  /** Tokens added per second */
  refillRate: number;
}

/**
 * In-memory per-IP token bucket rate limiter.
 * Not suitable for multi-instance deployments (use Redis for that).
 */
export class RateLimiter {
  private readonly buckets = new Map<string, BucketEntry>();
  private readonly config: RateLimiterConfig;

  constructor(config: RateLimiterConfig = { capacity: 10, refillRate: 1 }) {
    this.config = config;
  }

  /**
   * Check if a key (e.g. IP address) is allowed to proceed.
   * Returns { allowed, retryAfter } where retryAfter is seconds until allowed.
   */
  check(key: string): { allowed: boolean; retryAfter: number } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.config.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000;
    const refilled = Math.min(
      this.config.capacity,
      bucket.tokens + elapsed * this.config.refillRate,
    );
    bucket.tokens = refilled;
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, retryAfter: 0 };
    }

    const retryAfter = Math.ceil((1 - bucket.tokens) / this.config.refillRate);
    return { allowed: false, retryAfter };
  }

  /** Clear a specific key (for testing). */
  clear(key: string): void {
    this.buckets.delete(key);
  }

  /** Clear all buckets (for testing). */
  clearAll(): void {
    this.buckets.clear();
  }
}

// Singleton rate limiters for API routes
export const planRateLimiter = new RateLimiter({ capacity: 5, refillRate: 0.2 });
export const chatRateLimiter = new RateLimiter({ capacity: 20, refillRate: 2 });
export const refineRateLimiter = new RateLimiter({ capacity: 10, refillRate: 0.5 });

// ===== Origin Check =====

/**
 * Check that a request comes from the same origin.
 * Returns true if Origin matches Host or is absent (same-origin browser requests).
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin) return true; // Non-browser or same-origin (no Origin header)
  try {
    const url = new URL(origin);
    return url.host === host;
  } catch {
    return false;
  }
}

/**
 * Validate that Content-Type is application/json.
 */
export function isJsonContentType(request: Request): boolean {
  const ct = request.headers.get("content-type") ?? "";
  return ct.includes("application/json");
}

// ===== Generic Error Response =====

/** Create a generic error response that leaks no internals. */
export function genericError(message: string, status: number, retryAfter?: number): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
  };
  if (retryAfter !== undefined) {
    headers["Retry-After"] = String(retryAfter);
  }
  return new Response(JSON.stringify({ error: message }), { status, headers });
}

// ===== LRU Cache =====

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Simple in-memory LRU+TTL cache.
 */
export class LRUCache<T> {
  private readonly cache = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly maxSize: number = 50,
    private readonly ttlMs: number = 5 * 60 * 1000,
  ) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) this.cache.delete(key);
    if (this.cache.size >= this.maxSize) {
      // Delete oldest entry
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
}
