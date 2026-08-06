import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { databaseUrl } from './index';
import * as schema from './schema';

/**
 * Transaction boundary for multi-statement financial writes (CSV import,
 * cascading deletes, snapshot rebuilds).
 *
 * Neon's HTTP driver cannot hold a transaction open across statements, so this
 * opens a short-lived WebSocket session, runs the callback inside BEGIN/COMMIT
 * and closes the pool. Failure rolls the whole unit back — a partially imported
 * CSV must never survive.
 */

// Workers and Node 22+ both expose a global WebSocket; declaring it explicitly
// stops the driver from trying to require('ws') in environments that lack it.
if (typeof globalThis.WebSocket !== 'undefined') {
	neonConfig.webSocketConstructor = globalThis.WebSocket;
}

export type TransactionClient = Parameters<
	Parameters<NeonDatabase<typeof schema>['transaction']>[0]
>[0];

export async function withTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
	const pool = new Pool({ connectionString: databaseUrl() });
	try {
		const db = drizzle(pool, { schema, casing: 'snake_case' });
		return await db.transaction(async (tx) => fn(tx));
	} finally {
		// Always release the socket; a leaked pool keeps the isolate alive.
		await pool.end().catch(() => undefined);
	}
}
