import { getDb, type NeonDatabase } from './index';

/**
 * Read-side helpers.
 *
 * Kept separate from ./transaction.ts so a page load never accidentally opens a
 * WebSocket session it does not need, and so repositories can be handed either
 * the HTTP client or a transaction client without knowing which they hold.
 */

export function read(): NeonDatabase {
	return getDb();
}

/**
 * Runs independent read queries as one HTTP round trip instead of N.
 * Used by the dashboard, which needs six aggregates to render one screen.
 */
export async function readAll<T extends readonly Promise<unknown>[] | []>(
	queries: T
): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }> {
	return Promise.all(queries) as Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }>;
}

/** Clamp for any user-supplied page size, so a crafted query cannot pull a whole table. */
export const MAX_PAGE_SIZE = 200;
export const DEFAULT_PAGE_SIZE = 25;

export function pageBounds(page?: number, pageSize?: number) {
	const size = Math.min(Math.max(Math.trunc(pageSize ?? DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE);
	const current = Math.max(Math.trunc(page ?? 1), 1);
	return { limit: size, offset: (current - 1) * size, page: current, pageSize: size };
}
