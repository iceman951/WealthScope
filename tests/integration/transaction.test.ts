import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { TEST_DATABASE_URL, createTestUser, deleteTestUser, hasDatabase } from './setup';

/**
 * withTransaction issues BEGIN/COMMIT/ROLLBACK by hand on the shared SQLite
 * connection. A failed CSV import must leave nothing behind.
 */

const suite = hasDatabase ? describe : describe.skip;

suite('withTransaction (integration)', () => {
	it('commits on success and rolls back every write on failure', async () => {
		// getDb() reads DATABASE_URL through $env/dynamic/private.
		process.env.DATABASE_URL = TEST_DATABASE_URL;
		const { getDb, schema } = await import('../../src/lib/server/db');
		const { withTransaction } = await import('../../src/lib/server/db/transaction');
		const db = getDb();
		const user = await createTestUser(db, 'tx');
		const account = {
			userId: user.id,
			name: 'Tx',
			accountType: 'bank',
			currency: 'THB'
		} as const;
		const count = async () =>
			(
				await db
					.select()
					.from(schema.financialAccounts)
					.where(eq(schema.financialAccounts.userId, user.id))
			).length;

		await expect(
			withTransaction(async (tx) => {
				await tx.insert(schema.financialAccounts).values(account);
				await tx.insert(schema.financialAccounts).values(account);
				throw new Error('boom');
			})
		).rejects.toThrow('boom');
		expect(await count()).toBe(0);

		await withTransaction(async (tx) => {
			await tx.insert(schema.financialAccounts).values(account);
		});
		expect(await count()).toBe(1);

		await deleteTestUser(db, user.id);
	});
});
