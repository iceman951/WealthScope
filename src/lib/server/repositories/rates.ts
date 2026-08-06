import { and, desc, eq, lte, or } from 'drizzle-orm';
import { buildRateTable, type RateTable } from '$engine/currency';
import type { ExchangeRateInputPayload } from '$lib/schemas/financial';
import type { DbClient } from '../db';
import { read } from '../db/read';
import { exchangeRates } from '../db/schema';

/**
 * Exchange rates are reference data, shared across users. They contain nothing
 * personal, so they are the one table not scoped by `userId`.
 */

export async function listRates(db: DbClient = read()) {
	return db.select().from(exchangeRates).orderBy(desc(exchangeRates.rateDate));
}

/** The freshest rate for every pair on or before `asOf`. */
export async function ratesAsOf(asOf: string, db: DbClient = read()): Promise<RateTable> {
	const rows = await db
		.select()
		.from(exchangeRates)
		.where(lte(exchangeRates.rateDate, asOf))
		.orderBy(desc(exchangeRates.rateDate));
	return buildRateTable(rows);
}

export async function upsertRate(input: ExchangeRateInputPayload, db: DbClient = read()) {
	const rows = await db
		.insert(exchangeRates)
		.values({ ...input, source: 'manual' })
		.onConflictDoUpdate({
			target: [
				exchangeRates.baseCurrency,
				exchangeRates.quoteCurrency,
				exchangeRates.rateDate,
				exchangeRates.source
			],
			set: { rate: input.rate }
		})
		.returning();
	return rows[0];
}

export async function deleteRate(id: string, db: DbClient = read()) {
	const rows = await db
		.delete(exchangeRates)
		.where(eq(exchangeRates.id, id))
		.returning({ id: exchangeRates.id });
	return rows.length > 0;
}

/** Rates touching a given currency, for the settings screen's short list. */
export async function ratesForCurrency(currency: string, db: DbClient = read()) {
	return db
		.select()
		.from(exchangeRates)
		.where(or(eq(exchangeRates.baseCurrency, currency), eq(exchangeRates.quoteCurrency, currency)))
		.orderBy(desc(exchangeRates.rateDate))
		.limit(50);
}

export async function findRate(
	baseCurrency: string,
	quoteCurrency: string,
	rateDate: string,
	db: DbClient = read()
) {
	const rows = await db
		.select()
		.from(exchangeRates)
		.where(
			and(
				eq(exchangeRates.baseCurrency, baseCurrency),
				eq(exchangeRates.quoteCurrency, quoteCurrency),
				eq(exchangeRates.rateDate, rateDate)
			)
		)
		.limit(1);
	return rows[0] ?? null;
}
