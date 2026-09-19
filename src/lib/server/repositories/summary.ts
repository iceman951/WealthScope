import { sql } from 'drizzle-orm';
import type { DbClient } from '../db';
import { read } from '../db/read';
import { assets, cashflowEntries, liabilities, transactions } from '../db/schema';

/**
 * The counters the application shell shows. One round trip, not four, because
 * every protected page renders them.
 */
export interface ShellSummary {
	recordCount: number;
	lastUpdated: string | null;
}

export async function shellSummary(userId: string, db: DbClient = read()): Promise<ShellSummary> {
	// Timestamps are epoch milliseconds in SQLite, so the multi-argument scalar
	// `max()` picks the latest and the ISO conversion happens here, not in SQL.
	// SQLite's `max()` returns NULL if any argument is NULL, hence the coalesces.
	const rows = await db
		.select({
			recordCount: sql<number>`(
				(select count(*) from ${assets} where ${assets.userId} = ${userId}) +
				(select count(*) from ${liabilities} where ${liabilities.userId} = ${userId}) +
				(select count(*) from ${cashflowEntries} where ${cashflowEntries.userId} = ${userId}) +
				(select count(*) from ${transactions} where ${transactions.userId} = ${userId})
			)`,
			lastUpdated: sql<number>`max(
				coalesce((select max(${assets.updatedAt}) from ${assets} where ${assets.userId} = ${userId}), 0),
				coalesce((select max(${liabilities.updatedAt}) from ${liabilities} where ${liabilities.userId} = ${userId}), 0),
				coalesce((select max(${cashflowEntries.updatedAt}) from ${cashflowEntries} where ${cashflowEntries.userId} = ${userId}), 0),
				coalesce((select max(${transactions.updatedAt}) from ${transactions} where ${transactions.userId} = ${userId}), 0)
			)`
		})
		.from(sql`(select 1) as one`);

	const latest = Number(rows[0]?.lastUpdated ?? 0);
	return {
		recordCount: Number(rows[0]?.recordCount ?? 0),
		lastUpdated: latest > 0 ? new Date(latest).toISOString() : null
	};
}
