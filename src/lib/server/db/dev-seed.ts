import { getDb, schema } from './index';

/**
 * Development-only bootstrap: seeds the demo household into a database that has
 * no users at all.
 *
 * The test is "no users", not "no demo user": someone who deletes the demo
 * account deliberately should not find it resurrected on the next restart.
 *
 * Memoised, and the memo is assigned before the work is awaited so concurrent
 * first requests share one seed rather than racing to insert three households.
 * On failure the memo is cleared, so a transient error costs one request rather
 * than wedging the dev server until it is restarted. Parked on `globalThis`
 * because Vite re-evaluates server modules on edit and a module-level memo
 * would reset with them.
 *
 * The schema itself is wrangler's job (`pnpm db:migrate`); a missing table here
 * is reported as exactly that rather than as a seed failure.
 */

const READY_KEY = Symbol.for('wealthscope.dev-seed.ready');

interface Globals {
	[READY_KEY]?: Promise<void> | null;
}

const globals = globalThis as typeof globalThis & Globals;

export function ensureDevSeed(): Promise<void> {
	const existing = globals[READY_KEY];
	if (existing) return existing;

	const started = seedIfEmpty().catch((err) => {
		globals[READY_KEY] = null;
		throw err;
	});

	globals[READY_KEY] = started;
	return started;
}

async function seedIfEmpty(): Promise<void> {
	const db = getDb();

	let rows: { id: string }[];
	try {
		rows = await db.select({ id: schema.user.id }).from(schema.user).limit(1);
	} catch (err) {
		if (err instanceof Error && /no such table/i.test(err.message)) {
			throw new Error(
				'The local D1 database has no schema yet. Run `pnpm db:migrate` once, then restart `pnpm dev`.',
				{ cause: err }
			);
		}
		throw err;
	}
	if (rows.length > 0) return;

	const { seedDemoData } = await import('./seed-demo');
	await seedDemoData(db);
}
