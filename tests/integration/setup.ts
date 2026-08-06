import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import * as schema from '../../src/lib/server/db/schema/index';

/**
 * Integration-test harness.
 *
 * These tests exercise the real repositories against a real PostgreSQL database.
 * They are skipped unless TEST_DATABASE_URL is set, so `pnpm test` stays runnable
 * without infrastructure — see docs/deployment.md for how to point one at a Neon
 * branch in CI.
 */

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const hasDatabase = Boolean(TEST_DATABASE_URL);

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export function createTestDb(): { db: TestDb; close: () => Promise<void> } {
	if (!TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set.');
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
