import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { isPgliteUrl, pgliteDataDir } from './src/lib/server/db/pglite';

/**
 * `drizzle-kit generate` only reads the schema, so it works without a connection.
 * `migrate`, `push` and `studio` need DATABASE_URL and fail loudly without it.
 *
 * Both drivers speak the same dialect, so `generate` produces one set of SQL that
 * applies to PGlite and Neon alike. Against PGlite, stop the dev server first —
 * it holds the data directory open.
 */

const url = process.env.DATABASE_URL ?? '';
const pglite = isPgliteUrl(url);

export default defineConfig({
	schema: './src/lib/server/db/schema/index.ts',
	out: './drizzle',
	dialect: 'postgresql',
	...(pglite ? { driver: 'pglite' as const } : {}),
	dbCredentials: { url: pglite ? pgliteDataDir(url) : url },
	strict: true,
	verbose: true
});
