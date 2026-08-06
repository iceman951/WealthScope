import { and, asc, desc, eq, gte } from 'drizzle-orm';
import type { SnapshotInput } from '$engine/types';
import type { DbClient } from '../db';
import { read } from '../db/read';
import { portfolioSnapshots } from '../db/schema';

export type SnapshotRow = typeof portfolioSnapshots.$inferSelect;

export interface SnapshotValues {
	snapshotDate: string;
	baseCurrency: string;
	totalAssets: string;
	totalLiabilities: string;
	netWorth: string;
	liquidAssets: string;
	investmentAssets: string;
	metadataJson?: unknown;
}

export async function listSnapshots(
	userId: string,
	options: { since?: string; limit?: number } = {},
	db: DbClient = read()
) {
	const filters = [eq(portfolioSnapshots.userId, userId)];
	if (options.since) filters.push(gte(portfolioSnapshots.snapshotDate, options.since));

	const query = db
		.select()
		.from(portfolioSnapshots)
		.where(and(...filters))
		.orderBy(asc(portfolioSnapshots.snapshotDate));

	return options.limit ? query.limit(options.limit) : query;
}

export async function latestSnapshot(userId: string, db: DbClient = read()) {
	const rows = await db
		.select()
		.from(portfolioSnapshots)
		.where(eq(portfolioSnapshots.userId, userId))
		.orderBy(desc(portfolioSnapshots.snapshotDate))
		.limit(1);
	return rows[0] ?? null;
}

/**
 * One snapshot per user per date. Re-running the analysis on the same day
 * overwrites that day's row rather than accumulating duplicates.
 */
export async function upsertSnapshot(
	userId: string,
	values: SnapshotValues,
	db: DbClient = read()
) {
	const rows = await db
		.insert(portfolioSnapshots)
		.values({ ...values, userId })
		.onConflictDoUpdate({
			target: [portfolioSnapshots.userId, portfolioSnapshots.snapshotDate],
			set: {
				baseCurrency: values.baseCurrency,
				totalAssets: values.totalAssets,
				totalLiabilities: values.totalLiabilities,
				netWorth: values.netWorth,
				liquidAssets: values.liquidAssets,
				investmentAssets: values.investmentAssets,
				metadataJson: values.metadataJson
			}
		})
		.returning();
	return rows[0];
}

export function toEngineSnapshot(row: SnapshotRow): SnapshotInput {
	return {
		snapshotDate: row.snapshotDate,
		baseCurrency: row.baseCurrency,
		totalAssets: row.totalAssets,
		totalLiabilities: row.totalLiabilities,
		netWorth: row.netWorth
	};
}
