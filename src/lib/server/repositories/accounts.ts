import { and, asc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '../db';
import { read } from '../db/read';
import { assets, financialAccounts, liabilities, transactions } from '../db/schema';
import type { AccountInput } from '$lib/schemas/financial';

/**
 * Financial accounts.
 *
 * Every query in this file is filtered by `userId`. There is no method that can
 * read or write a row without one — the filter is not optional and never comes
 * from the request.
 */

export type FinancialAccountRow = typeof financialAccounts.$inferSelect;

export async function listAccounts(userId: string, db: DbClient = read()) {
	return db
		.select()
		.from(financialAccounts)
		.where(eq(financialAccounts.userId, userId))
		.orderBy(asc(financialAccounts.name));
}

/** Accounts with the counts the list screen shows, in one query rather than N+1. */
export async function listAccountsWithUsage(userId: string, db: DbClient = read()) {
	return db
		.select({
			id: financialAccounts.id,
			userId: financialAccounts.userId,
			name: financialAccounts.name,
			accountType: financialAccounts.accountType,
			institution: financialAccounts.institution,
			currency: financialAccounts.currency,
			description: financialAccounts.description,
			isActive: financialAccounts.isActive,
			createdAt: financialAccounts.createdAt,
			assetCount: sql<number>`(
				select count(*)::int from ${assets}
				where ${assets.accountId} = ${financialAccounts.id}
			)`,
			liabilityCount: sql<number>`(
				select count(*)::int from ${liabilities}
				where ${liabilities.accountId} = ${financialAccounts.id}
			)`,
			transactionCount: sql<number>`(
				select count(*)::int from ${transactions}
				where ${transactions.accountId} = ${financialAccounts.id}
			)`
		})
		.from(financialAccounts)
		.where(eq(financialAccounts.userId, userId))
		.orderBy(asc(financialAccounts.name));
}

export async function findAccount(userId: string, id: string, db: DbClient = read()) {
	const rows = await db
		.select()
		.from(financialAccounts)
		.where(and(eq(financialAccounts.userId, userId), eq(financialAccounts.id, id)))
		.limit(1);
	return rows[0] ?? null;
}

export async function createAccount(userId: string, input: AccountInput, db: DbClient = read()) {
	const rows = await db
		.insert(financialAccounts)
		.values({ ...input, userId })
		.returning();
	return rows[0];
}

export async function updateAccount(
	userId: string,
	id: string,
	input: AccountInput,
	db: DbClient = read()
) {
	const rows = await db
		.update(financialAccounts)
		.set(input)
		.where(and(eq(financialAccounts.userId, userId), eq(financialAccounts.id, id)))
		.returning();
	return rows[0] ?? null;
}

export async function deleteAccount(userId: string, id: string, db: DbClient = read()) {
	const rows = await db
		.delete(financialAccounts)
		.where(and(eq(financialAccounts.userId, userId), eq(financialAccounts.id, id)))
		.returning({ id: financialAccounts.id });
	return rows.length > 0;
}
