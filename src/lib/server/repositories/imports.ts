import { and, desc, eq } from 'drizzle-orm';
import type { ImportKind, ImportStatus } from '$lib/types/domain';
import type { DbClient } from '../db';
import { read } from '../db/read';
import { importBatches } from '../db/schema';

export type ImportBatchRow = typeof importBatches.$inferSelect;

export async function listImportBatches(userId: string, limit = 20, db: DbClient = read()) {
	return db
		.select()
		.from(importBatches)
		.where(eq(importBatches.userId, userId))
		.orderBy(desc(importBatches.createdAt))
		.limit(limit);
}

/**
 * Same user, same file contents, already imported successfully. Used to warn
 * before a second import rather than to block one outright — re-importing a file
 * is sometimes deliberate.
 */
export async function findPreviousImport(
	userId: string,
	contentHash: string,
	db: DbClient = read()
) {
	const rows = await db
		.select()
		.from(importBatches)
		.where(
			and(
				eq(importBatches.userId, userId),
				eq(importBatches.contentHash, contentHash),
				eq(importBatches.status, 'completed')
			)
		)
		.orderBy(desc(importBatches.createdAt))
		.limit(1);
	return rows[0] ?? null;
}

export async function createImportBatch(
	userId: string,
	values: {
		kind: ImportKind;
		fileName: string;
		fileSize: number;
		contentHash: string;
		rowCount: number;
	},
	db: DbClient = read()
) {
	const rows = await db
		.insert(importBatches)
		.values({ ...values, userId, status: 'pending' })
		.returning();
	return rows[0];
}

export async function completeImportBatch(
	userId: string,
	id: string,
	values: {
		status: ImportStatus;
		importedCount: number;
		rejectedCount: number;
		/** A count-level summary only; never the offending row's contents. */
		errorSummary?: string | null;
	},
	db: DbClient = read()
) {
	await db
		.update(importBatches)
		.set(values)
		.where(and(eq(importBatches.userId, userId), eq(importBatches.id, id)));
}
