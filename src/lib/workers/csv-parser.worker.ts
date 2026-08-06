/// <reference lib="webworker" />
import type { ImportKind } from '$lib/types/domain';
import { parseCsv, validateRows, type ColumnMapping } from '$lib/importers/csv';

/**
 * CSV parsing worker.
 *
 * Large files are parsed and validated here so the main thread keeps responding
 * while a 20,000-row broker export is checked. The result carries counts and
 * row-level errors, not the file itself.
 */

export interface ParseRequest {
	type: 'parse';
	text: string;
}

export interface ValidateRequest {
	type: 'validate';
	kind: ImportKind;
	text: string;
	mapping: ColumnMapping;
}

export type WorkerRequest = ParseRequest | ValidateRequest;

export interface ParseResponse {
	type: 'parsed';
	headers: string[];
	sample: Record<string, string>[];
	rowCount: number;
	parseErrors: { row: number; message: string }[];
	truncated: boolean;
}

export interface ValidateResponse {
	type: 'validated';
	validCount: number;
	rejected: {
		rowNumber: number;
		errors: Record<string, string[]>;
		preview: Record<string, string>;
	}[];
	missingRequired: string[];
	sample: Record<string, unknown>[];
}

export interface ErrorResponse {
	type: 'error';
	message: string;
}

export type WorkerResponse = ParseResponse | ValidateResponse | ErrorResponse;

const SAMPLE_SIZE = 20;
const MAX_REPORTED_REJECTIONS = 100;

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
	try {
		const request = event.data;

		if (request.type === 'parse') {
			const parsed = parseCsv(request.text);
			const response: ParseResponse = {
				type: 'parsed',
				headers: parsed.headers,
				sample: parsed.rows.slice(0, SAMPLE_SIZE),
				rowCount: parsed.rows.length,
				parseErrors: parsed.parseErrors.slice(0, MAX_REPORTED_REJECTIONS),
				truncated: parsed.truncated
			};
			self.postMessage(response);
			return;
		}

		const parsed = parseCsv(request.text);
		const outcome = validateRows<Record<string, unknown>>(
			request.kind,
			parsed.rows,
			request.mapping
		);
		const response: ValidateResponse = {
			type: 'validated',
			validCount: outcome.valid.length,
			// Cap what crosses the boundary: a broken file should not ship 20k errors.
			rejected: outcome.rejected.slice(0, MAX_REPORTED_REJECTIONS),
			missingRequired: outcome.missingRequired,
			sample: outcome.valid.slice(0, SAMPLE_SIZE).map((r) => r.value)
		};
		self.postMessage(response);
	} catch (err) {
		const response: ErrorResponse = {
			type: 'error',
			message: err instanceof Error ? err.message : 'The file could not be read.'
		};
		self.postMessage(response);
	}
});
