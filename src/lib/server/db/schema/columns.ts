import { sql } from 'drizzle-orm';
import { numeric, timestamp, varchar } from 'drizzle-orm/pg-core';

/**
 * Shared column builders.
 *
 * Every financial value is an exact PostgreSQL `numeric`. Drizzle returns these
 * as strings, and the engine parses them straight into Decimal — a value never
 * passes through a JavaScript `number` on the way in or out of the database.
 *
 * Precision budget:
 *   money      numeric(24, 8)   ≈ 10^16 major units at 8 dp
 *   quantity   numeric(30, 12)  fractional shares and 12-dp crypto units
 *   price      numeric(24, 8)
 *   fx rate    numeric(24, 12)  weak-currency pairs need the extra places
 *   rate / pct numeric(14, 8)   stored as a percentage, e.g. 3.40000000 = 3.4%
 */

export const money = (name: string) => numeric(name, { precision: 24, scale: 8 });
export const quantity = (name: string) => numeric(name, { precision: 30, scale: 12 });
export const price = (name: string) => numeric(name, { precision: 24, scale: 8 });
export const fxRate = (name: string) => numeric(name, { precision: 24, scale: 12 });
export const rate = (name: string) => numeric(name, { precision: 14, scale: 8 });

/** ISO 4217 alphabetic code, always upper-case. */
export const currency = (name = 'currency') => varchar(name, { length: 3 });

export const createdAt = () =>
	timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const updatedAt = () =>
	timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date());

/** `col IN ('a','b',…)` for a text column standing in for an enum. */
export function oneOf(column: string, values: readonly string[]) {
	const list = sql.join(
		values.map((v) => sql`${v}`),
		sql`, `
	);
	return sql`${sql.identifier(column)} IN (${list})`;
}

export const isCurrencyCode = (column: string) => sql`${sql.identifier(column)} ~ '^[A-Z]{3}$'`;

export const isNonNegative = (column: string) => sql`${sql.identifier(column)} >= 0`;
