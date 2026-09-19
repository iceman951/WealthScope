import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/d1/migrator';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { createDb, type DbClient } from '../../src/lib/server/db/index';
import * as schema from '../../src/lib/server/db/schema/index';

/**
 * Integration-test harness.
 *
 * These tests exercise the real repositories against a real D1 database: the
 * same workerd runtime and SQLite engine that `wrangler dev` uses, obtained
 * through wrangler's platform proxy with persistence switched off. Every suite
 * gets a throwaway database built from `drizzle/*.sql` — the migrations
 * production runs, unmodified — so no infrastructure and no network is needed
 * and the tests own their schema rather than assuming a migrated one.
 *
 * Set `SKIP_INTEGRATION=1` to leave them out of a run.
 */

export const hasDatabase = !process.env.SKIP_INTEGRATION;

/**
 * `DbClient` is re-exported under the name the tests already use. It comes from
 * `$lib/server/db`, which imports nothing from SvelteKit, so the same type
 * serves inside and outside the app.
 */
export type TestDb = DbClient;

export async function createTestDb(): Promise<{ db: TestDb; close: () => Promise<void> }> {
	const proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false });
	const db = createDb(proxy.env.DB);
	await migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
	return { db, close: () => proxy.dispose() };
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
