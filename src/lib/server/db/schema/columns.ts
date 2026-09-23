import { sql } from 'drizzle-orm';
import { integer, text } from 'drizzle-orm/sqlite-core';

/**
 * Shared column builders.
 *
 * SQLite has no exact decimal type — NUMERIC affinity silently turns values into
 * floats — so every financial value is stored as TEXT. Drizzle returns these as
 * strings and the engine parses them straight into Decimal; a value never passes
 * through a JavaScript `number` on the way in or out of the database.
 *
 * The precision budget (money 8 dp, quantity 12 dp, fx 12 dp, rate 8 dp) is now
 * enforced by the Zod schemas at the boundary rather than by the column type.
 */

export const money = (name: string) => text(name);
export const quantity = (name: string) => text(name);
export const price = (name: string) => text(name);
export const fxRate = (name: string) => text(name);
export const rate = (name: string) => text(name);

/** ISO 4217 alphabetic code, always upper-case. */
export const currency = (name = 'currency') => text(name, { length: 3 });

export const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' });

export const createdAt = () =>
	timestamp('created_at')
		.notNull()
		.$defaultFn(() => new Date());

export const updatedAt = () =>
	timestamp('updated_at')
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date());

export const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());

/**
 * `col IN ('a','b',…)` for a text column standing in for an enum.
 *
 * The values are inlined as literals rather than bound parameters: a CHECK
 * constraint is DDL and cannot take placeholders. Values are compile-time domain
 * constants; the quote doubling is belt and braces.
 */
export function oneOf(column: string, values: readonly string[]) {
	const list = sql.join(
		values.map((v) => sql.raw(`'${v.replace(/'/g, "''")}'`)),
		sql`, `
	);
	return sql`${sql.identifier(column)} IN (${list})`;
}

export const isCurrencyCode = (column: string) =>
	sql`${sql.identifier(column)} GLOB '[A-Z][A-Z][A-Z]'`;

/** Cast first: comparing a TEXT column to 0 would otherwise be a string comparison. */
export const isNonNegative = (column: string) => sql`CAST(${sql.identifier(column)} AS REAL) >= 0`;
