/**
 * CSV export.
 *
 * The export mirrors the import schema, so a round trip is lossless. Values are
 * written at full stored precision — an export is a backup, not a report, and
 * rounding it would lose data.
 */

/** Characters that make a spreadsheet treat a cell as a formula. */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Neutralises CSV formula injection. A cell beginning with `=`, `+`, `-` or `@`
 * is executed by Excel, Sheets and LibreOffice on open; prefixing a single quote
 * makes it inert while staying readable.
 *
 * Numbers are recognised and left alone, so "-1250.00" stays a number.
 */
export function sanitiseCell(value: unknown): string {
	if (value === null || value === undefined) return '';
	const text = String(value);
	if (text === '') return '';

	const isNumeric = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(text);
	if (!isNumeric && FORMULA_PREFIXES.some((prefix) => text.startsWith(prefix))) {
		return `'${text}`;
	}
	return text;
}

function quote(value: string): string {
	if (/[",\n\r]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

export interface CsvColumn<T> {
	header: string;
	value: (row: T) => unknown;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
	const lines: string[] = [columns.map((c) => quote(sanitiseCell(c.header))).join(',')];
	for (const row of rows) {
		lines.push(columns.map((c) => quote(sanitiseCell(c.value(row)))).join(','));
	}
	// A trailing newline keeps POSIX tools and Excel equally happy.
	return `${lines.join('\r\n')}\r\n`;
}

/** BOM so Excel opens UTF-8 exports with Thai text intact. */
export const UTF8_BOM = '﻿';

export function csvResponse(filename: string, body: string): Response {
	return new Response(UTF8_BOM + body, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
			'cache-control': 'private, no-store'
		}
	});
}
