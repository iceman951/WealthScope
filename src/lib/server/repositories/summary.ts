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
	const rows = await db
		.select({
			recordCount: sql<number>`(
				(select count(*) from ${assets} where ${assets.userId} = ${userId}) +
				(select count(*) from ${liabilities} where ${liabilities.userId} = ${userId}) +
				(select count(*) from ${cashflowEntries} where ${cashflowEntries.userId} = ${userId}) +
				(select count(*) from ${transactions} where ${transactions.userId} = ${userId})
			)::int`,
			lastUpdated: sql<string | null>`greatest(
				(select max(${assets.updatedAt}) from ${assets} where ${assets.userId} = ${userId}),
				(select max(${liabilities.updatedAt}) from ${liabilities} where ${liabilities.userId} = ${userId}),
				(select max(${cashflowEntries.updatedAt}) from ${cashflowEntries} where ${cashflowEntries.userId} = ${userId}),
				(select max(${transactions.updatedAt}) from ${transactions} where ${transactions.userId} = ${userId})
			)::text`
		})
		.from(sql`(select 1) as one`);

	return {
		recordCount: rows[0]?.recordCount ?? 0,
		lastUpdated: rows[0]?.lastUpdated ?? null
	};
}
