import { sql } from 'drizzle-orm';
import { getDb, type DbClient } from './index';

/**
 * Transaction boundary for multi-statement financial writes (CSV import,
 * cascading deletes, snapshot rebuilds). Failure rolls the whole unit back — a
 * partially imported CSV must never survive.
 *
 * drizzle's bun-sqlite `transaction()` is synchronous and would commit before an
 * async callback's queries run, so BEGIN/COMMIT are issued by hand around the
 * callback instead.
 */

export type TransactionClient = DbClient;

// ponytail: one connection, so transactions are serialised through a global
// lock and a query from another request can still interleave inside one. Fine for
// a single-process POC; use a per-transaction connection or a real server DB later.
let queue: Promise<unknown> = Promise.resolve();

export function withTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
	const run = queue.then(async () => {
		const db = getDb();
		db.run(sql`BEGIN IMMEDIATE`);
		try {
			const result = await fn(db);
			db.run(sql`COMMIT`);
			return result;
		} catch (err) {
			db.run(sql`ROLLBACK`);
			throw err;
		}
	});
	queue = run.catch(() => undefined);
	return run;
}
