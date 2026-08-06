import { and, asc, eq } from 'drizzle-orm';
import type { GoalInputPayload } from '$lib/schemas/financial';
import type { DbClient } from '../db';
import { read } from '../db/read';
import { financialGoals } from '../db/schema';

export type GoalRow = typeof financialGoals.$inferSelect;

export async function listGoals(userId: string, db: DbClient = read()) {
	return db
		.select()
		.from(financialGoals)
		.where(eq(financialGoals.userId, userId))
		.orderBy(asc(financialGoals.targetDate), asc(financialGoals.name));
}

export async function findGoal(userId: string, id: string, db: DbClient = read()) {
	const rows = await db
		.select()
		.from(financialGoals)
		.where(and(eq(financialGoals.userId, userId), eq(financialGoals.id, id)))
		.limit(1);
	return rows[0] ?? null;
}

export async function createGoal(userId: string, input: GoalInputPayload, db: DbClient = read()) {
	const rows = await db
		.insert(financialGoals)
		.values({ ...input, userId })
		.returning();
	return rows[0];
}

export async function updateGoal(
	userId: string,
	id: string,
	input: GoalInputPayload,
	db: DbClient = read()
) {
	const rows = await db
		.update(financialGoals)
		.set(input)
		.where(and(eq(financialGoals.userId, userId), eq(financialGoals.id, id)))
		.returning();
	return rows[0] ?? null;
}

export async function deleteGoal(userId: string, id: string, db: DbClient = read()) {
	const rows = await db
		.delete(financialGoals)
		.where(and(eq(financialGoals.userId, userId), eq(financialGoals.id, id)))
		.returning({ id: financialGoals.id });
	return rows.length > 0;
}
