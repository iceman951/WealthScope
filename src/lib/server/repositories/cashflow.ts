import { and, asc, desc, eq, type SQL } from 'drizzle-orm';
import type { CashflowCategory, CashflowEntryType, Frequency } from '$lib/types/domain';
import type { CashflowInputPayload } from '$lib/schemas/financial';
import type { CashflowInput } from '$engine/types';
import type { DbClient } from '../db';
import { read } from '../db/read';
import { cashflowEntries } from '../db/schema';

export type CashflowRow = typeof cashflowEntries.$inferSelect;

export async function listCashflowEntries(
	userId: string,
	options: { entryType?: CashflowEntryType } = {},
	db: DbClient = read()
) {
	const filters: SQL[] = [eq(cashflowEntries.userId, userId)];
	if (options.entryType) filters.push(eq(cashflowEntries.entryType, options.entryType));

	return db
		.select()
		.from(cashflowEntries)
		.where(and(...filters))
		.orderBy(asc(cashflowEntries.entryType), desc(cashflowEntries.amount));
}

export async function findCashflowEntry(userId: string, id: string, db: DbClient = read()) {
	const rows = await db
		.select()
		.from(cashflowEntries)
		.where(and(eq(cashflowEntries.userId, userId), eq(cashflowEntries.id, id)))
		.limit(1);
	return rows[0] ?? null;
}

export async function createCashflowEntry(
	userId: string,
	input: CashflowInputPayload,
	db: DbClient = read()
) {
	const rows = await db
		.insert(cashflowEntries)
		.values({ ...input, userId })
		.returning();
	return rows[0];
}

export async function updateCashflowEntry(
	userId: string,
	id: string,
	input: CashflowInputPayload,
	db: DbClient = read()
) {
	const rows = await db
		.update(cashflowEntries)
		.set(input)
		.where(and(eq(cashflowEntries.userId, userId), eq(cashflowEntries.id, id)))
		.returning();
	return rows[0] ?? null;
}

export async function deleteCashflowEntry(userId: string, id: string, db: DbClient = read()) {
	const rows = await db
		.delete(cashflowEntries)
		.where(and(eq(cashflowEntries.userId, userId), eq(cashflowEntries.id, id)))
		.returning({ id: cashflowEntries.id });
	return rows.length > 0;
}

export function toEngineCashflow(row: CashflowRow): CashflowInput {
	return {
		id: row.id,
		entryType: row.entryType as CashflowEntryType,
		category: row.category as CashflowCategory,
		name: row.name,
		amount: row.amount,
		currency: row.currency,
		frequency: row.frequency as Frequency,
		entryDate: row.entryDate,
		endDate: row.endDate,
		isRecurring: row.isRecurring,
		notes: row.notes
	};
}
