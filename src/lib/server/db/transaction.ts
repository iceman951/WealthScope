import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';
import { databaseUrl } from './index';
import { isPgliteUrl, pgliteDb } from './pglite';
import * as schema from './schema';

/**
 * Transaction boundary for multi-statement financial writes (CSV import,
 * cascading deletes, snapshot rebuilds).
 *
 * Neon's HTTP driver cannot hold a transaction open across statements, so the
 * Neon path opens a short-lived WebSocket session, runs the callback inside
 * BEGIN/COMMIT and closes the pool. PGlite is a single in-process connection and
 * has no pool to open, so it transacts on the instance the bootstrap built.
 *
 * Either way, failure rolls the whole unit back — a partially imported CSV must
 * never survive.
 */

// Workers and Node 22+ both expose a global WebSocket; declaring it explicitly
// stops the driver from trying to require('ws') in environments that lack it.
// Inert on the PGlite path, which opens no socket.
if (typeof globalThis.WebSocket !== 'undefined') {
	neonConfig.webSocketConstructor = globalThis.WebSocket;
}

/**
 * Driver-agnostic transaction handle. Widened from the Neon-specific type so the
 * same callback compiles against both drivers; `services/import.ts` derives its
 * own `Tx` type from this signature, so its call sites need no change.
 */
export type TransactionClient = PgTransaction<
	PgQueryResultHKT,
	typeof schema,
	ExtractTablesWithRelations<typeof schema>
>;

export async function withTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
	const url = databaseUrl();

	if (isPgliteUrl(url)) {
		// One process, one connection: reuse the live instance rather than
		// opening a pool PGlite does not have.
		return pgliteDb().transaction(async (tx) => fn(tx));
	}

	const pool = new Pool({ connectionString: url });
	try {
		const db = drizzle(pool, { schema, casing: 'snake_case' });
		return await db.transaction(async (tx) => fn(tx));
	} finally {
		// Always release the socket; a leaked pool keeps the isolate alive.
		await pool.end().catch(() => undefined);
	}
}
