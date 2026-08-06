import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { ImportKind } from '$lib/types/domain';
import {
	MAX_CSV_BYTES,
	MAX_CSV_ROWS,
	PREVIEW_ROWS,
	contentHash,
	guessMapping,
	parseCsv,
	validateRows,
	type ColumnMapping,
	type RejectedRow
} from '$lib/importers/csv';
import { IMPORT_DEFINITIONS } from '$lib/importers/definitions';
import { withTransaction } from '../db/transaction';
import {
	assets,
	cashflowEntries,
	financialAccounts,
	liabilities,
	transactions
} from '../db/schema';
import {
	completeImportBatch,
	createImportBatch,
	findPreviousImport
} from '../repositories/imports';
import { transactionSignature } from '../repositories/transactions';
import { log } from '../security/logging';

/**
 * CSV import.
 *
 * Two passes. The preview pass validates and reports; nothing is written. The
 * commit pass re-validates on the server — the browser's preview is never trusted
 * — and writes every accepted row inside one transaction, so a failure leaves the
 * account exactly as it was.
 *
 * CSV contents are never logged and never persisted; only counts, the file name
 * and a content hash are recorded.
 */

export interface ImportPreview {
	kind: ImportKind;
	headers: string[];
	mapping: ColumnMapping;
	rowCount: number;
	validCount: number;
	rejected: RejectedRow[];
	rejectedCount: number;
	missingRequired: string[];
	/** First few accepted rows, so the user can see what will land. */
	sample: Record<string, unknown>[];
	parseErrors: { row: number; message: string }[];
	truncated: boolean;
	/** Set when this exact file was imported before. */
	previousImport: { fileName: string; importedAt: string } | null;
	contentHash: string;
}

export function assertUploadAcceptable(file: { size: number; type: string; name: string }): void {
	if (file.size === 0) error(400, 'That file is empty.');
	if (file.size > MAX_CSV_BYTES) {
		error(413, `Files are limited to ${Math.round(MAX_CSV_BYTES / 1024 / 1024)} MB.`);
	}
	const looksLikeCsv =
		file.name.toLowerCase().endsWith('.csv') ||
		file.type === 'text/csv' ||
		file.type === 'application/vnd.ms-excel' ||
		file.type === 'text/plain' ||
		file.type === '';
	if (!looksLikeCsv) error(415, 'Upload a .csv file.');
}

export async function previewImport(
	userId: string,
	kind: ImportKind,
	text: string,
	mapping?: ColumnMapping
): Promise<ImportPreview> {
	const parsed = parseCsv(text);
	const effectiveMapping = mapping ?? guessMapping(kind, parsed.headers);
	const outcome = validateRows<Record<string, unknown>>(kind, parsed.rows, effectiveMapping);
	const hash = await contentHash(text);
	const previous = await findPreviousImport(userId, hash);

	return {
		kind,
		headers: parsed.headers,
		mapping: effectiveMapping,
		rowCount: parsed.rows.length,
		validCount: outcome.valid.length,
		rejected: outcome.rejected.slice(0, 100),
		rejectedCount: outcome.rejected.length,
		missingRequired: outcome.missingRequired,
		sample: outcome.valid.slice(0, PREVIEW_ROWS).map((row) => row.value),
		parseErrors: parsed.parseErrors.slice(0, 100),
		truncated: parsed.truncated,
		previousImport: previous
			? { fileName: previous.fileName, importedAt: previous.createdAt.toISOString().slice(0, 10) }
			: null,
		contentHash: hash
	};
}

export interface ImportOutcome {
	batchId: string;
	imported: number;
	rejected: number;
	skippedDuplicates: number;
}

export async function commitImport(
	userId: string,
	kind: ImportKind,
	text: string,
	mapping: ColumnMapping,
	fileName: string
): Promise<ImportOutcome> {
	const parsed = parseCsv(text);
	if (parsed.rows.length > MAX_CSV_ROWS) {
		error(413, `That file has more than ${MAX_CSV_ROWS.toLocaleString('en-US')} rows.`);
	}

	// The authoritative validation pass. Whatever the browser previewed, this is
	// what decides which rows exist.
	const outcome = validateRows<Record<string, unknown>>(kind, parsed.rows, mapping);
	if (outcome.missingRequired.length > 0) {
		error(400, `Map these columns first: ${outcome.missingRequired.join(', ')}.`);
	}

	const hash = await contentHash(text);
	const batch = await createImportBatch(userId, {
		kind,
		fileName: fileName.slice(0, 255),
		fileSize: new TextEncoder().encode(text).length,
		contentHash: hash,
		rowCount: parsed.rows.length
	});

	try {
		const result = await withTransaction(async (tx) => {
			switch (kind) {
				case 'assets':
					return insertAssets(
						tx,
						userId,
						outcome.valid.map((r) => r.value)
					);
				case 'liabilities':
					return insertLiabilities(
						tx,
						userId,
						outcome.valid.map((r) => r.value)
					);
				case 'cashflow':
					return insertCashflow(
						tx,
						userId,
						outcome.valid.map((r) => r.value)
					);
				case 'transactions':
					return insertTransactions(
						tx,
						userId,
						batch.id,
						outcome.valid.map((r) => r.value)
					);
			}
		});

		await completeImportBatch(userId, batch.id, {
			status: 'completed',
			importedCount: result.imported,
			rejectedCount: outcome.rejected.length,
			errorSummary:
				outcome.rejected.length > 0 ? `${outcome.rejected.length} rows failed validation` : null
		});

		log('info', {
			event: 'import.completed',
			user: userId,
			count: result.imported,
			reason: kind
		});

		return {
			batchId: batch.id,
			imported: result.imported,
			rejected: outcome.rejected.length,
			skippedDuplicates: result.skipped
		};
	} catch (err) {
		await completeImportBatch(userId, batch.id, {
			status: 'failed',
			importedCount: 0,
			rejectedCount: outcome.rejected.length,
			errorSummary: 'The import was rolled back; nothing was saved.'
		});
		log('error', {
			event: 'import.failed',
			user: userId,
			reason: err instanceof Error ? err.name : 'unknown'
		});
		error(
			500,
			'The import failed and was rolled back. Nothing was saved, so you can safely try again.'
		);
	}
}

type Tx = Parameters<Parameters<typeof withTransaction>[0]>[0];
type Row = Record<string, unknown>;

function str(value: unknown, fallback = ''): string {
	return value === null || value === undefined ? fallback : String(value);
}

function nullableStr(value: unknown): string | null {
	return value === null || value === undefined || value === '' ? null : String(value);
}

async function insertAssets(tx: Tx, userId: string, rows: readonly Row[]) {
	if (rows.length === 0) return { imported: 0, skipped: 0 };
	await tx.insert(assets).values(
		rows.map((row) => ({
			userId,
			name: str(row.name),
			assetType: str(row.assetType),
			symbol: nullableStr(row.symbol),
			currency: str(row.currency),
			quantity: str(row.quantity, '1'),
			unitPrice: str(row.unitPrice, '0'),
			manualValue: nullableStr(row.manualValue),
			acquisitionCost: nullableStr(row.acquisitionCost),
			valuationDate: str(row.valuationDate),
			notes: 'Imported from CSV'
		}))
	);
	return { imported: rows.length, skipped: 0 };
}

async function insertLiabilities(tx: Tx, userId: string, rows: readonly Row[]) {
	if (rows.length === 0) return { imported: 0, skipped: 0 };
	await tx.insert(liabilities).values(
		rows.map((row) => ({
			userId,
			name: str(row.name),
			liabilityType: str(row.liabilityType),
			currency: str(row.currency),
			originalPrincipal: str(row.originalPrincipal),
			outstandingBalance: str(row.outstandingBalance),
			interestRate: str(row.interestRate),
			monthlyPayment: nullableStr(row.monthlyPayment),
			maturityDate: nullableStr(row.maturityDate),
			notes: 'Imported from CSV'
		}))
	);
	return { imported: rows.length, skipped: 0 };
}

async function insertCashflow(tx: Tx, userId: string, rows: readonly Row[]) {
	if (rows.length === 0) return { imported: 0, skipped: 0 };
	await tx.insert(cashflowEntries).values(
		rows.map((row) => ({
			userId,
			entryType: str(row.entryType),
			category: str(row.category),
			name: str(row.name),
			amount: str(row.amount),
			currency: str(row.currency),
			frequency: str(row.frequency, 'monthly'),
			entryDate: str(row.entryDate),
			isRecurring: str(row.frequency, 'monthly') !== 'once',
			notes: 'Imported from CSV'
		}))
	);
	return { imported: rows.length, skipped: 0 };
}

/**
 * Transactions need their account and holding resolved by name inside the same
 * transaction, and are checked against existing rows so a re-imported statement
 * does not duplicate a trade.
 */
async function insertTransactions(tx: Tx, userId: string, batchId: string, rows: readonly Row[]) {
	if (rows.length === 0) return { imported: 0, skipped: 0 };

	const accountRows = await tx
		.select({ id: financialAccounts.id, name: financialAccounts.name })
		.from(financialAccounts)
		.where(eq(financialAccounts.userId, userId));
	const accountsByName = new Map(accountRows.map((a) => [a.name.toLowerCase(), a.id]));

	const assetRows = await tx
		.select({ id: assets.id, symbol: assets.symbol })
		.from(assets)
		.where(eq(assets.userId, userId));
	const assetsBySymbol = new Map(
		assetRows.filter((a) => a.symbol).map((a) => [a.symbol!.toLowerCase(), a.id])
	);

	const existing = await tx
		.select({
			accountId: transactions.accountId,
			transactionDate: transactions.transactionDate,
			transactionType: transactions.transactionType,
			grossAmount: transactions.grossAmount
		})
		.from(transactions)
		.where(eq(transactions.userId, userId));
	const seen = new Set(existing.map(transactionSignature));

	const values: (typeof transactions.$inferInsert)[] = [];
	let skipped = 0;

	for (const row of rows) {
		const accountId = accountsByName.get(str(row.accountName).toLowerCase());
		if (!accountId) {
			throw new Error('unknown-account');
		}
		const symbol = nullableStr(row.symbol);
		const assetId = symbol ? (assetsBySymbol.get(symbol.toLowerCase()) ?? null) : null;

		const candidate = {
			accountId,
			transactionDate: str(row.transactionDate),
			transactionType: str(row.transactionType),
			grossAmount: str(row.grossAmount)
		};
		const signature = transactionSignature(candidate);
		if (seen.has(signature)) {
			skipped += 1;
			continue;
		}
		seen.add(signature);

		values.push({
			userId,
			accountId,
			assetId,
			transactionType: candidate.transactionType,
			transactionDate: candidate.transactionDate,
			quantity: nullableStr(row.quantity),
			unitPrice: nullableStr(row.unitPrice),
			grossAmount: candidate.grossAmount,
			feeAmount: str(row.feeAmount, '0'),
			taxAmount: str(row.taxAmount, '0'),
			currency: str(row.currency),
			importBatchId: batchId,
			notes: 'Imported from CSV'
		});
	}

	if (values.length > 0) await tx.insert(transactions).values(values);
	return { imported: values.length, skipped };
}

export async function verifyAccountsExist(userId: string): Promise<boolean> {
	const rows = await withTransaction(async (tx) =>
		tx
			.select({ id: financialAccounts.id })
			.from(financialAccounts)
			.where(and(eq(financialAccounts.userId, userId)))
			.limit(1)
	);
	return rows.length > 0;
}

export { IMPORT_DEFINITIONS };
