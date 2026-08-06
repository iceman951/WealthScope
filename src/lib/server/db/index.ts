import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

/**
 * Server-only database module.
 *
 * Reads and single-statement writes go over Neon's HTTP driver: no connection to
 * hold open, which is what a Cloudflare Worker wants. Multi-statement financial
 * writes go through `withTransaction()` in ./transaction.ts, which opens a real
 * session over WebSockets for the duration of the transaction and closes it.
 *
 * DATABASE_URL is read from `$env/dynamic/private`, so it resolves from the
 * Worker's secrets at request time and never reaches a client bundle.
 */

let cached: NeonDatabase | null = null;
let cachedUrl: string | null = null;

export type NeonDatabase = ReturnType<typeof createDb>;

function createDb(connectionString: string) {
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
 * The shared query client. Built lazily because `$env/dynamic/private` is only
 * populated once the Worker has a request context, and re-built if the URL
 * changes between isolate reuses (preview vs production bindings).
 */
export function getDb(): NeonDatabase {
	const url = databaseUrl();
	if (!cached || cachedUrl !== url) {
		cached = createDb(url);
		cachedUrl = url;
	}
	return cached;
}

export { schema };

/**
 * What a repository accepts: either the HTTP query client or a transaction
 * client. Both are `PgDatabase`s over the same schema, so a repository method
 * works identically inside and outside a transaction.
 */
export type DbClient = PgDatabase<
	PgQueryResultHKT,
	typeof schema,
	ExtractTablesWithRelations<typeof schema>
>;
