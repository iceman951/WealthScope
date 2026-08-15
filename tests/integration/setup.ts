import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, type ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';
import * as schema from '../../src/lib/server/db/schema/index';
import { createPgliteDb, isPgliteUrl, migratePglite } from '../../src/lib/server/db/pglite';

/**
 * Integration-test harness.
 *
 * These tests exercise the real repositories against a real PostgreSQL database.
 * They are skipped unless TEST_DATABASE_URL is set.
 *
 * Set it to `memory://` to run them against a throwaway in-process PGlite
 * database — real PostgreSQL, no infrastructure, schema built from the same
 * migrations production uses. A postgresql:// URL points them at Neon instead;
 * see docs/deployment.md for pointing one at a Neon branch in CI.
 */

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const hasDatabase = Boolean(TEST_DATABASE_URL);

/**
 * Driver-agnostic, and declared from `drizzle-orm/pg-core` rather than imported
 * from `$lib/server/db` — that module reads `$env/dynamic/private`, which does
 * not exist outside SvelteKit.
 */
export type TestDb = PgDatabase<
	PgQueryResultHKT,
	typeof schema,
	ExtractTablesWithRelations<typeof schema>
>;

export async function createTestDb(): Promise<{ db: TestDb; close: () => Promise<void> }> {
	if (!TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set.');

	if (isPgliteUrl(TEST_DATABASE_URL)) {
		// A fresh instance per suite, with the schema built from drizzle/*.sql, so
		// the tests own their database rather than assuming a migrated one.
		const { client, db } = await createPgliteDb(TEST_DATABASE_URL);
		await migratePglite(db);
		return { db, close: () => client.close() };
	}

	const pool = new Pool({ connectionString: TEST_DATABASE_URL });
	const db = drizzle(pool, { schema, casing: 'snake_case' });
	return { db, close: () => pool.end() };
}

export interface TestUser {
	id: string;
	email: string;
}

/** Creates an isolated user so parallel runs cannot see each other's rows. */
export async function createTestUser(db: TestDb, label: string): Promise<TestUser> {
	const id = randomUUID();
	const email = `test-${label}-${id.slice(0, 8)}@wealthscope.test`;
	const now = new Date();

	await db.insert(schema.user).values({
		id,
		name: `Test ${label}`,
		email,
		emailVerified: true,
		createdAt: now,
		updatedAt: now
	});
	await db.insert(schema.userFinancialSettings).values({ userId: id, onboardedAt: now });

	return { id, email };
}

/** Cascades remove everything the user owns. */
export async function deleteTestUser(db: TestDb, userId: string): Promise<void> {
	await db.delete(schema.transactions).where(eq(schema.transactions.userId, userId));
	await db.delete(schema.assets).where(eq(schema.assets.userId, userId));
	await db.delete(schema.financialAccounts).where(eq(schema.financialAccounts.userId, userId));
	await db.delete(schema.user).where(eq(schema.user.id, userId));
}

export { schema };
