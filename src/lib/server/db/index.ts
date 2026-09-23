import { env } from '$env/dynamic/private';
import { openDb, type DbClient } from './open';
import * as schema from './schema';

/**
 * Server-only database module: one SQLite file opened through `bun:sqlite`.
 * DATABASE_URL is a file path; pending migrations are applied on first use.
 */

export type { DbClient };

let cached: DbClient | null = null;

export function getDb(): DbClient {
	if (!env.DATABASE_URL) {
		throw new Error('DATABASE_URL is not configured. Set it in .env to a SQLite file path.');
	}
	cached ??= openDb(env.DATABASE_URL);
	return cached;
}

export { schema };
