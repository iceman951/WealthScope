import { getTableColumns, type InferInsertModel } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { DbClient } from './index';

/**
 * Atomic multi-statement writes on D1.
 *
 * D1 has no interactive transactions: `BEGIN` is rejected, so there is no
 * `db.transaction(async (tx) => …)` in which reads and writes interleave. What
 * it has instead is `batch()`, which runs a list of prepared statements as one
 * implicit transaction — either every statement commits or none does.
 *
 * The consequence for callers is a two-phase shape: read whatever the write
 * depends on first, build the complete set of rows, then hand them here. That
 * is how the CSV import works (services/import.ts), and it keeps the guarantee
 * that matters — a partially imported file never survives a failure.
 */

/**
 * D1 binds at most 100 parameters to one statement. A multi-row INSERT spends
 * one parameter per column per row, so the rows per statement is bounded by
 * the table's width. Kept slightly under the limit for the parameters Drizzle
 * adds on its own (`$defaultFn` ids and timestamps are bound, not defaulted).
 */
export const D1_MAX_BOUND_PARAMETERS = 100;

/** Rows per INSERT for a table, from its full column count — an upper bound on parameters. */
export function insertChunkSize(table: SQLiteTable): number {
	const width = Object.keys(getTableColumns(table)).length;
	return Math.max(1, Math.floor(D1_MAX_BOUND_PARAMETERS / width));
}

export function chunk<T>(rows: readonly T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
	return out;
}

/**
 * Inserts every row or none of them.
 *
 * The rows are split into statements that respect the parameter limit and the
 * statements are sent as one batch, so a constraint failure on row 4,000 rolls
 * back rows 1–3,999 as well. An empty list is a no-op rather than an empty
 * batch, which D1 rejects.
 */
export async function insertAll<TTable extends SQLiteTable>(
	db: DbClient,
	table: TTable,
	rows: readonly InferInsertModel<TTable>[]
): Promise<number> {
	if (rows.length === 0) return 0;
	const statements = chunk(rows, insertChunkSize(table)).map((part) =>
		db.insert(table).values(part as InferInsertModel<TTable>[])
	);
	await runAtomically(db, statements);
	return rows.length;
}

/** Runs arbitrary statements as one atomic batch. Empty input is a no-op. */
export async function runAtomically(
	db: DbClient,
	statements: readonly BatchItem<'sqlite'>[]
): Promise<void> {
	if (statements.length === 0) return;
	const [first, ...rest] = statements;
	await db.batch([first, ...rest]);
}
