import Papa from 'papaparse';
import type { ImportKind } from '$lib/types/domain';
import { fieldErrors } from '$lib/schemas/common';
import { IMPORT_DEFINITIONS, guessMapping } from './definitions';
import type { ZodError } from 'zod';

/**
 * CSV parsing, column mapping and row validation.
 *
 * Runs identically in the browser (preview), in a Web Worker (large files) and on
 * the server (the authoritative pass before anything is written). The server pass
 * is the one that counts; the browser's is a convenience preview.
 */

export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 20_000;
export const PREVIEW_ROWS = 20;

export interface ParsedCsv {
	headers: string[];
	rows: Record<string, string>[];
	/** Rows Papa Parse could not read at all — malformed quoting, ragged columns. */
	parseErrors: { row: number; message: string }[];
	truncated: boolean;
}

export function parseCsv(text: string, options: { maxRows?: number } = {}): ParsedCsv {
	const maxRows = options.maxRows ?? MAX_CSV_ROWS;
	const result = Papa.parse<Record<string, string>>(text, {
		header: true,
		skipEmptyLines: 'greedy',
		transformHeader: (header) => header.trim(),
		dynamicTyping: false
	});

	const rows = (result.data ?? []).slice(0, maxRows);

	return {
		headers: result.meta?.fields ?? [],
		rows,
		parseErrors: (result.errors ?? []).map((e) => ({
			row: (e.row ?? 0) + 2, // +1 for the header line, +1 for 1-based numbering
			message: e.message
		})),
		truncated: (result.data?.length ?? 0) > maxRows
	};
}

export type ColumnMapping = Record<string, string | null>;

export interface ValidRow<T> {
	rowNumber: number;
	value: T;
	raw: Record<string, string>;
}

export interface RejectedRow {
	rowNumber: number;
	/** Field-keyed messages, e.g. { currency: ['Use a three-letter code'] }. */
	errors: Record<string, string[]>;
	/** Only the mapped cells, so a rejection message never carries the whole row. */
	preview: Record<string, string>;
}

export interface ValidationOutcome<T> {
	valid: ValidRow<T>[];
	rejected: RejectedRow[];
	/** Required fields the mapping left unassigned. */
	missingRequired: string[];
}

/** Applies the user's column mapping to one CSV row. */
export function applyMapping(
	row: Record<string, string>,
	mapping: ColumnMapping
): Record<string, string> {
	const mapped: Record<string, string> = {};
	for (const [field, column] of Object.entries(mapping)) {
		if (!column) continue;
		const value = row[column];
		if (value !== undefined && value !== null && String(value).trim() !== '') {
			mapped[field] = String(value).trim();
		}
	}
	return mapped;
}

export function validateRows<T>(
	kind: ImportKind,
	rows: readonly Record<string, string>[],
	mapping: ColumnMapping
): ValidationOutcome<T> {
	const definition = IMPORT_DEFINITIONS[kind];
	const missingRequired = definition.fields
		.filter((f) => f.required && !mapping[f.key])
		.map((f) => f.label);

	if (missingRequired.length > 0) {
		return { valid: [], rejected: [], missingRequired };
	}

	const valid: ValidRow<T>[] = [];
	const rejected: RejectedRow[] = [];

	rows.forEach((row, index) => {
		const rowNumber = index + 2; // header is line 1
		const mapped = applyMapping(row, mapping);
		const result = definition.rowSchema.safeParse(mapped);

		if (result.success) {
			valid.push({ rowNumber, value: result.data as T, raw: mapped });
		} else {
			rejected.push({
				rowNumber,
				errors: fieldErrors(result.error as ZodError),
				preview: mapped
			});
		}
	});

	return { valid, rejected, missingRequired: [] };
}

export { guessMapping, IMPORT_DEFINITIONS };

/** SHA-256 of the file contents, used to spot a repeat import. */
export async function contentHash(text: string): Promise<string> {
	const bytes = new TextEncoder().encode(text);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A stable signature per row, so the same row twice in one file imports once. */
export function rowSignature(value: Record<string, unknown>, keys: readonly string[]): string {
	return keys.map((key) => String(value[key] ?? '')).join('|');
}
