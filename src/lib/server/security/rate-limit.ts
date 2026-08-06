/**
 * Rate limiting.
 *
 * The default implementation is an in-memory fixed window. In a Cloudflare Worker
 * each isolate has its own memory, so this raises the cost of a naive attack but
 * is not a cluster-wide guarantee. `setRateLimiter()` is the documented extension
 * point: swap in Cloudflare's Rate Limiting binding, a Durable Object or KV
 * without touching a call site.
 *
 * See docs/security.md for the production wiring.
 */

export interface RateLimitResult {
	allowed: boolean;
	/** Seconds until the window resets. */
	retryAfter: number;
	remaining: number;
}

export interface RateLimiter {
	consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

interface Bucket {
	count: number;
	resetAt: number;
}

class MemoryRateLimiter implements RateLimiter {
	private buckets = new Map<string, Bucket>();

	async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
		const now = Date.now();
		const bucket = this.buckets.get(key);

		if (!bucket || bucket.resetAt <= now) {
			this.buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
			this.sweep(now);
			return { allowed: true, retryAfter: 0, remaining: limit - 1 };
		}

		bucket.count += 1;
		const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
		if (bucket.count > limit) {
			return { allowed: false, retryAfter, remaining: 0 };
		}
		return { allowed: true, retryAfter, remaining: limit - bucket.count };
	}

	/** Keeps the map from growing without bound in a long-lived isolate. */
	private sweep(now: number) {
		if (this.buckets.size < 5000) return;
		for (const [key, bucket] of this.buckets) {
			if (bucket.resetAt <= now) this.buckets.delete(key);
		}
	}
}

let limiter: RateLimiter = new MemoryRateLimiter();

export function setRateLimiter(next: RateLimiter): void {
	limiter = next;
}

/** Named policies, so the numbers live in one place. */
export const RATE_LIMITS = {
	login: { limit: 8, windowSeconds: 300 },
	register: { limit: 5, windowSeconds: 3600 },
	passwordReset: { limit: 5, windowSeconds: 3600 },
	report: { limit: 20, windowSeconds: 3600 },
	import: { limit: 15, windowSeconds: 3600 },
	mutation: { limit: 240, windowSeconds: 60 }
} as const;

export type RateLimitPolicy = keyof typeof RATE_LIMITS;

export function consume(policy: RateLimitPolicy, identifier: string): Promise<RateLimitResult> {
	const { limit, windowSeconds } = RATE_LIMITS[policy];
	return limiter.consume(`${policy}:${identifier}`, limit, windowSeconds);
}

/** Client address for anonymous policies. Falls back to a constant, never to a guess. */
export function clientKey(request: Request): string {
	return (
		request.headers.get('cf-connecting-ip') ??
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		'unknown'
	);
}
