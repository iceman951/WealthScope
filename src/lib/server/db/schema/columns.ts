import { sql } from 'drizzle-orm';
import { integer, text } from 'drizzle-orm/sqlite-core';

/**
 * Shared column builders.
 *
 * Every financial value is stored as `text` holding an exact decimal string.
 * D1 is SQLite, which has no arbitrary-precision numeric type: a REAL column
 * would round anything past 15–16 significant digits, and NUMERIC affinity
 * would silently convert '1234567890123456.12345678' into a REAL on the way in.
 * TEXT affinity stores the bytes it is given, so the engine's `toStorage()`
 * strings come back unchanged and are parsed straight into Decimal — a value
 * never passes through a JavaScript `number` on the way in or out.
 *
 * Precision budget (enforced by the engine, documented here):
 *   money      ≈ 10^16 major units at 8 dp
 *   quantity   fractional shares and 12-dp crypto units
 *   price      8 dp
 *   fx rate    12 dp — weak-currency pairs need the extra places
 *   rate / pct 8 dp, stored as a percentage, e.g. 3.40000000 = 3.4%
 */

export const money = (name: string) => text(name);
export const quantity = (name: string) => text(name);
export const price = (name: string) => text(name);
export const fxRate = (name: string) => text(name);
export const rate = (name: string) => text(name);

/**
 * UUID keys as text. SQLite has no uuid type and D1 has no `gen_random_uuid()`,
 * so primary keys are generated here, on insert, with the runtime's
 * `crypto.randomUUID()` — available in Workers and Node alike.
 */
export const uuid = (name: string) => text(name);
export const uuidPrimaryKey = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());

/** ISO 4217 alphabetic code, always upper-case. */
export const currency = (name = 'currency') => text(name, { length: 3 });

/** Calendar date as ISO `YYYY-MM-DD`. Sorts and compares correctly as text. */
export const isoDate = (name: string) => text(name);

/**
 * Instants are integer milliseconds since the epoch. Drizzle converts to and
 * from `Date` on the way through, so callers never see the integer.
 */
export const instant = (name: string) => integer(name, { mode: 'timestamp_ms' });

export const createdAt = () =>
	instant('created_at')
		.notNull()
		.$defaultFn(() => new Date());

export const updatedAt = () =>
	instant('updated_at')
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date());

/**
 * `col IN ('a','b',…)` for a text column standing in for an enum.
 *
 * The values are inlined as literals rather than bound parameters: a CHECK
 * constraint is DDL, and SQLite rejects placeholders there — drizzle-kit would
 * otherwise emit `IN (?, ?)` into the migration and the CREATE TABLE would
 * fail. Values are compile-time domain constants; the quote doubling is belt
 * and braces.
 */
export function oneOf(column: string, values: readonly string[]) {
	const list = sql.join(
		values.map((v) => sql.raw(`'${v.replace(/'/g, "''")}'`)),
		sql`, `
	);
	return sql`${sql.identifier(column)} IN (${list})`;
}

/** SQLite has no regex operator; GLOB with a character class covers `^[A-Z]{3}$`. */
export const isCurrencyCode = (column: string) =>
	sql`${sql.identifier(column)} GLOB '[A-Z][A-Z][A-Z]'`;

/**
 * Sign checks on decimal-string columns. The cast may round, but a sign never
 * survives rounding the wrong way, so `>= 0` and `> 0` remain exact. NULL casts
 * to NULL, which passes a CHECK, matching how nullable columns behaved before.
 */
export const isNonNegative = (column: string) => sql`CAST(${sql.identifier(column)} AS REAL) >= 0`;

export const isPositive = (column: string) => sql`CAST(${sql.identifier(column)} AS REAL) > 0`;
