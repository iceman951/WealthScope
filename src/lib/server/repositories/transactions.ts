import { and, count, desc, eq, gte, inArray, lte, type SQL } from 'drizzle-orm';
import type { TransactionType } from '$lib/types/domain';
import type { TransactionInputPayload } from '$lib/schemas/financial';
import type { TransactionInput } from '$engine/types';
import type { DbClient } from '../db';
import { pageBounds, read } from '../db/read';
import { assets, financialAccounts, transactions } from '../db/schema';

export type TransactionRow = typeof transactions.$inferSelect;

const selection = {
	id: transactions.id,
	userId: transactions.userId,
	accountId: transactions.accountId,
	accountName: financialAccounts.name,
	assetId: transactions.assetId,
	assetName: assets.name,
	assetSymbol: assets.symbol,
	transactionType: transactions.transactionType,
	transactionDate: transactions.transactionDate,
	quantity: transactions.quantity,
	unitPrice: transactions.unitPrice,
	grossAmount: transactions.grossAmount,
	feeAmount: transactions.feeAmount,
	taxAmount: transactions.taxAmount,
	currency: transactions.currency,
	exchangeRate: transactions.exchangeRate,
	notes: transactions.notes,
	createdAt: transactions.createdAt
};

export type TransactionWithNames = Awaited<ReturnType<typeof listTransactions>>[number];

export async function listTransactions(
	userId: string,
	options: {
		assetId?: string;
		accountId?: string;
		types?: readonly TransactionType[];
		from?: string;
		to?: string;
		limit?: number;
	} = {},
	db: DbClient = read()
) {
	const filters: SQL[] = [eq(transactions.userId, userId)];
	if (options.assetId) filters.push(eq(transactions.assetId, options.assetId));
	if (options.accountId) filters.push(eq(transactions.accountId, options.accountId));
	if (options.types?.length)
		filters.push(inArray(transactions.transactionType, [...options.types]));
	if (options.from) filters.push(gte(transactions.transactionDate, options.from));
	if (options.to) filters.push(lte(transactions.transactionDate, options.to));

	const query = db
		.select(selection)
		.from(transactions)
		.leftJoin(financialAccounts, eq(transactions.accountId, financialAccounts.id))
		.leftJoin(assets, eq(transactions.assetId, assets.id))
		.where(and(...filters))
		.orderBy(desc(transactions.transactionDate), desc(transactions.createdAt));

	return options.limit ? query.limit(options.limit) : query;
}

export async function listTransactionsPaged(
	userId: string,
	options: { assetId?: string; page?: number; pageSize?: number } = {},
	db: DbClient = read()
) {
	const { limit, offset, page, pageSize } = pageBounds(options.page, options.pageSize);
	const filters: SQL[] = [eq(transactions.userId, userId)];
	if (options.assetId) filters.push(eq(transactions.assetId, options.assetId));
	const where = and(...filters);

	const [rows, totals] = await Promise.all([
		db
			.select(selection)
			.from(transactions)
			.leftJoin(financialAccounts, eq(transactions.accountId, financialAccounts.id))
			.leftJoin(assets, eq(transactions.assetId, assets.id))
			.where(where)
			.orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
			.limit(limit)
			.offset(offset),
		db.select({ total: count() }).from(transactions).where(where)
	]);

	return { rows, total: totals[0]?.total ?? 0, page, pageSize };
}

export async function findTransaction(userId: string, id: string, db: DbClient = read()) {
	const rows = await db
		.select()
		.from(transactions)
		.where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
		.limit(1);
	return rows[0] ?? null;
}

export async function createTransaction(
	userId: string,
	input: TransactionInputPayload & { importBatchId?: string | null },
	db: DbClient = read()
) {
	const rows = await db
		.insert(transactions)
		.values({ ...input, userId })
		.returning();
	return rows[0];
}

export async function updateTransaction(
	userId: string,
	id: string,
	input: TransactionInputPayload,
	db: DbClient = read()
) {
	const rows = await db
		.update(transactions)
		.set(input)
		.where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
		.returning();
	return rows[0] ?? null;
}

export async function deleteTransaction(userId: string, id: string, db: DbClient = read()) {
	const rows = await db
		.delete(transactions)
		.where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
		.returning({ id: transactions.id });
	return rows.length > 0;
}

/**
 * Duplicate guard for imports: a row with the same account, date, type and amount
 * is almost certainly the same transaction imported twice.
 */
export async function findDuplicateSignatures(
	userId: string,
	candidates: readonly {
		accountId: string;
		transactionDate: string;
		transactionType: string;
		grossAmount: string;
	}[],
	db: DbClient = read()
): Promise<Set<string>> {
	if (candidates.length === 0) return new Set();

	const dates = [...new Set(candidates.map((c) => c.transactionDate))].sort();
	const rows = await db
		.select({
			accountId: transactions.accountId,
			transactionDate: transactions.transactionDate,
			transactionType: transactions.transactionType,
			grossAmount: transactions.grossAmount
		})
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				gte(transactions.transactionDate, dates[0]),
				lte(transactions.transactionDate, dates[dates.length - 1])
			)
		);

	return new Set(rows.map(transactionSignature));
}

export function transactionSignature(row: {
	accountId: string;
	transactionDate: string;
	transactionType: string;
	grossAmount: string;
}): string {
	// Normalising the amount stops "100" and "100.00000000" reading as different rows.
	const amount = Number.parseFloat(row.grossAmount).toFixed(4);
	return `${row.accountId}|${row.transactionDate}|${row.transactionType}|${amount}`;
}

export function toEngineTransaction(row: TransactionRow | TransactionWithNames): TransactionInput {
	return {
		id: row.id,
		assetId: row.assetId,
		transactionType: row.transactionType as TransactionType,
		transactionDate: row.transactionDate,
		quantity: row.quantity,
		unitPrice: row.unitPrice,
		grossAmount: row.grossAmount,
		feeAmount: row.feeAmount,
		taxAmount: row.taxAmount,
		currency: row.currency,
		exchangeRate: row.exchangeRate
	};
}
