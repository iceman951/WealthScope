import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

/**
 * Server-only database module.
 *
 * One driver: Cloudflare D1 over Drizzle. The database is a Worker binding, not
 * a connection string — there is nothing to connect to and nothing to hold
 * open. The same binding serves every environment:
 *
 *   vite dev / vite preview   adapter-cloudflare emulates `platform.env` through
 *                             wrangler's getPlatformProxy, so `DB` is a local
 *                             SQLite file under .wrangler/state. No service to
 *                             start, and the data survives restarts.
 *   wrangler dev              the same local database, on workerd.
 *   wrangler deploy           the real D1 database named in wrangler.jsonc.
 *
 * This module imports nothing from SvelteKit, so `scripts/seed.ts` under tsx and
 * `tests/integration/setup.ts` under Vitest can build a client from a binding
 * they obtained themselves.
 */

/**
 * What a repository accepts. There is exactly one client type — D1 has no
 * interactive transactions, so there is no separate transaction client; see
 * ./batch.ts for how multi-statement writes stay atomic.
 */
export type DbClient = DrizzleD1Database<typeof schema>;

/**
 * Wraps a D1 binding in Drizzle.
 *
 * `casing: 'snake_case'` is load-bearing: the schema declares camelCase
 * properties against snake_case columns, and a client configured differently
 * would emit `"userId"` against a `user_id` column.
 */
export function createDb(binding: D1Database): DbClient {
	return drizzle(binding, { schema, casing: 'snake_case' });
}

let boundTo: D1Database | null = null;
let cached: DbClient | null = null;

/**
 * Records the request's D1 binding so `getDb()` can hand it out synchronously.
 *
 * Called from `handleDatabase` in src/hooks.server.ts before anything touches
 * the database. Bindings are per deployment, not per request — every request an
 * isolate serves sees the same `DB` object — so parking it at module scope is
 * safe, and the Drizzle client is only rebuilt if the object changes (isolate
 * reuse across a preview/production boundary, or a test swapping databases).
 */
export function bindDatabase(binding: D1Database): DbClient {
	if (!cached || boundTo !== binding) {
		cached = createDb(binding);
		boundTo = binding;
	}
	return cached;
}

/**
 * The shared query client.
 *
 * Synchronous, and it must stay that way: `read()` calls it as a default
 * parameter value at some sixty repository call sites, and a default parameter
 * cannot be awaited. The binding therefore arrives ahead of the request in
 * `handleDatabase`, and this only hands back what that already built.
 */
export function getDb(): DbClient {
	if (!cached) {
		throw new Error(
			'The D1 binding is not attached. bindDatabase() must run before getDb() — check that handleDatabase is still in the hooks.server.ts chain, and that wrangler.jsonc declares the "DB" d1_databases binding.'
		);
	}
	return cached;
}

export { schema };
