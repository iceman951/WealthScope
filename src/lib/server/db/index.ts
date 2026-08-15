import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { env } from '$env/dynamic/private';
import * as schema from './schema';
import { isPgliteUrl, pgliteDb } from './pglite';

/**
 * Server-only database module.
 *
 * Two drivers sit behind one entry point, chosen by the shape of DATABASE_URL:
 *
 *   postgresql://…   Neon. Reads and single-statement writes go over the HTTP
 *                    driver — no connection to hold open, which is what a
 *                    Cloudflare Worker wants. Multi-statement financial writes
 *                    go through `withTransaction()` in ./transaction.ts.
 *   file:./.pglite   PGlite, for local development. Real PostgreSQL compiled to
 *   memory://        WebAssembly, in this process. See ./pglite.ts.
 *
 * The predicate is the URL rather than `dev` from `$app/environment`, because
 * `vite preview` — which Playwright builds and runs against — reports `dev` as
 * false while still reading .env, and would silently fall through to Neon.
 *
 * DATABASE_URL is read from `$env/dynamic/private`, so it resolves from the
 * Worker's secrets at request time and never reaches a client bundle.
 */

/**
 * What a repository accepts: the Neon client, the PGlite client, or a transaction
 * client. All are `PgDatabase`s over the same schema, so a repository method
 * works identically across drivers and inside or outside a transaction.
 */
export type DbClient = PgDatabase<
	PgQueryResultHKT,
	typeof schema,
	ExtractTablesWithRelations<typeof schema>
>;

let cached: DbClient | null = null;
let cachedUrl: string | null = null;

function createDb(connectionString: string): DbClient {
	return drizzle(neon(connectionString), { schema, casing: 'snake_case' });
}

export function databaseUrl(): string {
	const url = env.DATABASE_URL;
	if (!url) {
		throw new Error(
			'DATABASE_URL is not configured. Set it in .env locally, or as a Worker secret in production.'
		);
	}
	return url;
}

/**
 * The shared query client.
 *
 * Synchronous, and it must stay that way: `read()` calls it as a default
 * parameter value at some sixty repository call sites, and a default parameter
 * cannot be awaited. PGlite's asynchronous bootstrap therefore runs ahead of the
 * request in `handleDatabase` (src/hooks.server.ts), and `pgliteDb()` only hands
 * back the instance that bootstrap already built.
 *
 * The Neon client is built lazily, because `$env/dynamic/private` is only
 * populated once the Worker has a request context, and re-built if the URL
 * changes between isolate reuses (preview vs production bindings).
 */
export function getDb(): DbClient {
	const url = databaseUrl();
	if (isPgliteUrl(url)) return pgliteDb();

	if (!cached || cachedUrl !== url) {
		cached = createDb(url);
		cachedUrl = url;
	}
	return cached;
}

export { schema };
