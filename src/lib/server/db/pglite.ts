import { resolve } from 'node:path';
import * as schema from './schema';
import type { DbClient } from './index';
// Type-only, so these erase at compile time and create no runtime edge to the
// modules the comment below goes to such lengths to keep out of the bundle.
import type { PGlite } from '@electric-sql/pglite';
import type { PgliteDatabase } from 'drizzle-orm/pglite';

/**
 * PGlite: PostgreSQL 17 compiled to WebAssembly, running inside this process.
 *
 * Used for local development only. It is real PostgreSQL, so `drizzle/*.sql`,
 * every `numeric` column, the CHECK constraints and the POSIX regex operators
 * all behave exactly as they do on Neon — the schema needs no dialect of its own.
 *
 * This module deliberately imports nothing from SvelteKit (`$env`, `$app`, …) so
 * that `scripts/seed.ts` under tsx and `tests/integration/setup.ts` under Vitest
 * can both use it.
 */

/**
 * The specifiers are held in variables so Rollup cannot follow them.
 *
 * This is load-bearing, not stylistic: `drizzle-orm/pglite/driver.js` imports
 * `PGlite` statically, so a normal `import` — even a normal dynamic `import()`
 * with a literal — pulls roughly 3 MB of WebAssembly into the Cloudflare Worker
 * bundle, where it can never run. Hidden behind a variable and `@vite-ignore`,
 * the specifier survives into the build verbatim and Node resolves it at run
 * time, while the Worker never evaluates the branch that reaches it.
 *
 * Do not "tidy" these into static imports.
 */
const PGLITE = '@electric-sql/pglite';
const DRIVER = 'drizzle-orm/pglite';
const MIGRATOR = 'drizzle-orm/pglite/migrator';

/** `DATABASE_URL` forms that mean "use PGlite" rather than "connect to Postgres". */
export function isPgliteUrl(url: string): boolean {
	return url.startsWith('file:') || url === 'memory://';
}

/**
 * `file://./.pglite` and `file:./.pglite` both mean the directory `./.pglite`.
 * `memory://` is passed through — PGlite understands it as "do not persist".
 */
export function pgliteDataDir(url: string): string {
	if (url === 'memory://') return url;
	const path = url.replace(/^file:\/\//, '').replace(/^file:/, '');
	return path === '' ? './.pglite' : path;
}

type PgliteDb = PgliteDatabase<typeof schema>;

interface Holder {
	client: PGlite;
	db: PgliteDb;
}

/**
 * Vite reloads server modules on edit, and a second `new PGlite()` against a data
 * directory the first one still holds throws "dataDir is locked". Parking the
 * instance on `globalThis` means a re-evaluated module finds the live one.
 */
const HOLDER_KEY = Symbol.for('wealthscope.pglite.holder');
const READY_KEY = Symbol.for('wealthscope.pglite.ready');

interface Globals {
	[HOLDER_KEY]?: Holder;
	[READY_KEY]?: Promise<void> | null;
}

const globals = globalThis as typeof globalThis & Globals;

/**
 * Opens a PGlite database and wraps it in Drizzle.
 *
 * `casing: 'snake_case'` must match the Neon client in ./index.ts exactly — the
 * schema declares camelCase properties against snake_case columns, and a driver
 * configured differently would emit `"userId"` against a `user_id` column.
 */
export async function createPgliteDb(url: string): Promise<Holder> {
	const { PGlite } = (await import(
		/* @vite-ignore */ PGLITE
	)) as typeof import('@electric-sql/pglite');
	const { drizzle } = (await import(
		/* @vite-ignore */ DRIVER
	)) as typeof import('drizzle-orm/pglite');

	const client = new PGlite(pgliteDataDir(url));
	await client.waitReady;
	const db = drizzle(client, { schema, casing: 'snake_case' });

	return { client, db };
}

/** Applies `drizzle/*.sql` — the same migrations Neon runs, unmodified. */
export async function migratePglite(db: PgliteDb): Promise<void> {
	const { migrate } = (await import(
		/* @vite-ignore */ MIGRATOR
	)) as typeof import('drizzle-orm/pglite/migrator');
	await migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
}

/**
 * Brings the database up once per process: open, migrate, and seed if empty.
 *
 * Memoised, and the memo is assigned before the work is awaited so that
 * concurrent first requests share one bootstrap rather than racing to create
 * three databases. On failure the memo is cleared, so a transient error costs
 * one request rather than wedging the dev server until it is restarted.
 */
export function ensurePglite(url: string): Promise<void> {
	const existing = globals[READY_KEY];
	if (existing) return existing;

	const started = (async () => {
		const holder = await createPgliteDb(url);
		globals[HOLDER_KEY] = holder;
		await migratePglite(holder.db);
		await seedIfEmpty(holder.db);
	})().catch((err) => {
		// Clear the memo so the next request retries instead of replaying this
		// rejection forever.
		globals[READY_KEY] = null;
		globals[HOLDER_KEY] = undefined;
		throw err;
	});

	globals[READY_KEY] = started;
	return started;
}

/**
 * Seeds the demo household into a database that has no users at all.
 *
 * The test is "no users", not "no demo user": someone who deletes the demo
 * account deliberately should not find it resurrected on the next restart.
 */
async function seedIfEmpty(db: PgliteDb): Promise<void> {
	const rows = await db.select({ id: schema.user.id }).from(schema.user).limit(1);
	if (rows.length > 0) return;

	const { seedDemoData } = await import('./seed-demo');
	await seedDemoData(db);
}

/**
 * The live client, synchronously.
 *
 * `getDb()` and `read()` are synchronous — `read()` is a default parameter value
 * at some sixty repository call sites, and a default parameter cannot be awaited.
 * `ensurePglite()` therefore runs ahead of them in the request pipeline, and this
 * only hands back what the bootstrap already built.
 */
export function pgliteDb(): DbClient {
	const holder = globals[HOLDER_KEY];
	if (!holder) {
		throw new Error(
			'PGlite is not ready. ensurePglite() must run before getDb() — check that handleDatabase is still in the hooks.server.ts chain.'
		);
	}
	return holder.db;
}

/** Releases the data directory. Tests need this; the dev server never calls it. */
export async function closePglite(): Promise<void> {
	const holder = globals[HOLDER_KEY];
	globals[HOLDER_KEY] = undefined;
	globals[READY_KEY] = null;
	if (holder) await holder.client.close();
}
