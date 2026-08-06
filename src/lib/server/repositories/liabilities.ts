import { and, asc, eq } from 'drizzle-orm';
import type { LiabilityType } from '$lib/types/domain';
import type { LiabilityInputPayload } from '$lib/schemas/financial';
import type { LiabilityInput } from '$engine/types';
import type { DbClient } from '../db';
import { read } from '../db/read';
import { liabilities } from '../db/schema';

export type LiabilityRow = typeof liabilities.$inferSelect;

export async function listLiabilities(userId: string, db: DbClient = read()) {
	return db
		.select()
		.from(liabilities)
		.where(eq(liabilities.userId, userId))
		.orderBy(asc(liabilities.name));
}

export async function findLiability(userId: string, id: string, db: DbClient = read()) {
	const rows = await db
		.select()
		.from(liabilities)
		.where(and(eq(liabilities.userId, userId), eq(liabilities.id, id)))
		.limit(1);
	return rows[0] ?? null;
}

export async function createLiability(
	userId: string,
	input: LiabilityInputPayload,
	db: DbClient = read()
) {
	const rows = await db
		.insert(liabilities)
		.values({ ...input, userId })
		.returning();
	return rows[0];
}

export async function updateLiability(
	userId: string,
	id: string,
	input: LiabilityInputPayload,
	db: DbClient = read()
) {
	const rows = await db
		.update(liabilities)
		.set(input)
		.where(and(eq(liabilities.userId, userId), eq(liabilities.id, id)))
		.returning();
	return rows[0] ?? null;
}

export async function deleteLiability(userId: string, id: string, db: DbClient = read()) {
	const rows = await db
		.delete(liabilities)
		.where(and(eq(liabilities.userId, userId), eq(liabilities.id, id)))
		.returning({ id: liabilities.id });
	return rows.length > 0;
}

export function toEngineLiability(row: LiabilityRow): LiabilityInput {
	return {
		id: row.id,
		name: row.name,
		liabilityType: row.liabilityType as LiabilityType,
		currency: row.currency,
		originalPrincipal: row.originalPrincipal,
		outstandingBalance: row.outstandingBalance,
		interestRate: row.interestRate,
		minimumPayment: row.minimumPayment,
		monthlyPayment: row.monthlyPayment,
		startDate: row.startDate,
		maturityDate: row.maturityDate
	};
}
