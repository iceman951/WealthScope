import { describe, expect, it } from 'vitest';
import {
	applyMapping,
	contentHash,
	guessMapping,
	parseCsv,
	rowSignature,
	validateRows
} from '../../src/lib/importers/csv';
import {
	normaliseAssetType,
	normaliseCashflowCategory,
	normaliseLiabilityType
} from '../../src/lib/importers/definitions';
import { sanitiseCell, toCsv } from '../../src/lib/exporters/csv';
import { transactionSignature } from '../../src/lib/server/repositories/transactions';

const ASSET_CSV = `name,asset_type,currency,quantity,unit_price,valuation_date
Emergency savings,cash,THB,1,640000,2026-08-01
Condominium,Real estate,THB,1,8400000,2026-07-15`;

describe('parseCsv', () => {
	it('reads headers and rows', () => {
		const parsed = parseCsv(ASSET_CSV);
		expect(parsed.headers).toContain('asset_type');
		expect(parsed.rows).toHaveLength(2);
		expect(parsed.rows[0].name).toBe('Emergency savings');
	});

	it('skips blank lines', () => {
		const parsed = parseCsv(`${ASSET_CSV}\n\n\n`);
		expect(parsed.rows).toHaveLength(2);
	});

	it('handles quoted fields containing commas', () => {
		const parsed = parseCsv('name,value\n"Smith, John",100');
		expect(parsed.rows[0].name).toBe('Smith, John');
	});

	it('truncates beyond the row cap', () => {
		const many = ['name', ...Array.from({ length: 30 }, (_, i) => `row-${i}`)].join('\n');
		const parsed = parseCsv(many, { maxRows: 10 });
		expect(parsed.rows).toHaveLength(10);
		expect(parsed.truncated).toBe(true);
	});
});

describe('guessMapping', () => {
	it('matches headers to fields by alias', () => {
		const mapping = guessMapping('assets', [
			'name',
			'asset_type',
			'currency',
			'quantity',
			'unit_price',
			'valuation_date'
		]);
		expect(mapping.name).toBe('name');
		expect(mapping.assetType).toBe('asset_type');
		expect(mapping.valuationDate).toBe('valuation_date');
	});

	it('matches loosely worded headers', () => {
		const mapping = guessMapping('assets', ['Record', 'Class', 'Currency', 'Value', 'Date']);
		expect(mapping.name).toBe('Record');
		expect(mapping.assetType).toBe('Class');
		expect(mapping.manualValue).toBe('Value');
	});

	it('leaves an unmatched field null rather than guessing wrong', () => {
		const mapping = guessMapping('assets', ['alpha', 'beta']);
		expect(mapping.valuationDate).toBeNull();
	});

	it('never assigns the same column to two fields', () => {
		const mapping = guessMapping('assets', ['name', 'currency', 'date']);
		const assigned = Object.values(mapping).filter(Boolean);
		expect(new Set(assigned).size).toBe(assigned.length);
	});
});

describe('applyMapping', () => {
	it('renames columns and drops blanks', () => {
		const mapped = applyMapping(
			{ Record: 'Savings', Value: '' },
			{ name: 'Record', manualValue: 'Value' }
		);
		expect(mapped).toEqual({ name: 'Savings' });
	});
});

describe('validateRows', () => {
	it('accepts rows that satisfy the schema', () => {
		const parsed = parseCsv(ASSET_CSV);
		const mapping = guessMapping('assets', parsed.headers);
		const outcome = validateRows('assets', parsed.rows, mapping);
		expect(outcome.valid).toHaveLength(2);
		expect(outcome.rejected).toHaveLength(0);
	});

	it('translates a human-readable class name to an asset type', () => {
		const parsed = parseCsv(ASSET_CSV);
		const outcome = validateRows<{ assetType: string }>(
			'assets',
			parsed.rows,
			guessMapping('assets', parsed.headers)
		);
		expect(outcome.valid[1].value.assetType).toBe('property');
	});

	it('reports a bad row with its line number and reason, never dropping it silently', () => {
		const csv = `name,asset_type,currency,quantity,unit_price,valuation_date
Good,cash,THB,1,100,2026-08-01
Bad,cash,NOTACURRENCY,1,100,2026-08-01`;
		const parsed = parseCsv(csv);
		const outcome = validateRows('assets', parsed.rows, guessMapping('assets', parsed.headers));
		expect(outcome.valid).toHaveLength(1);
		expect(outcome.rejected).toHaveLength(1);
		expect(outcome.rejected[0].rowNumber).toBe(3);
		expect(outcome.rejected[0].errors.currency).toBeDefined();
	});

	it('refuses to validate at all when a required column is unmapped', () => {
		const parsed = parseCsv(ASSET_CSV);
		const outcome = validateRows('assets', parsed.rows, { name: 'name' });
		expect(outcome.valid).toHaveLength(0);
		expect(outcome.missingRequired.length).toBeGreaterThan(0);
	});
});

describe('type normalisation', () => {
	it('maps spreadsheet wording onto asset types', () => {
		expect(normaliseAssetType('Real estate')).toBe('property');
		expect(normaliseAssetType('Cash & deposits')).toBe('cash');
		expect(normaliseAssetType('Equities')).toBe('stock');
		expect(normaliseAssetType('etf')).toBe('etf');
		expect(normaliseAssetType('nonsense')).toBe('nonsense'); // rejected downstream
	});

	it('maps wording onto liability types', () => {
		expect(normaliseLiabilityType('Credit card')).toBe('credit_card');
		expect(normaliseLiabilityType('Car loan')).toBe('auto_loan');
	});

	it('maps wording onto cash-flow categories', () => {
		expect(normaliseCashflowCategory('Mortgage & housing')).toBe('housing');
		expect(normaliseCashflowCategory('salary')).toBe('salary');
	});
});

describe('duplicate detection', () => {
	it('gives identical transactions the same signature', () => {
		const a = {
			accountId: 'acc',
			transactionDate: '2026-01-01',
			transactionType: 'buy',
			grossAmount: '100'
		};
		const b = { ...a, grossAmount: '100.00000000' };
		expect(transactionSignature(a)).toBe(transactionSignature(b));
	});

	it('distinguishes transactions that differ', () => {
		const a = {
			accountId: 'acc',
			transactionDate: '2026-01-01',
			transactionType: 'buy',
			grossAmount: '100'
		};
		expect(transactionSignature(a)).not.toBe(transactionSignature({ ...a, grossAmount: '101' }));
		expect(transactionSignature(a)).not.toBe(
			transactionSignature({ ...a, transactionDate: '2026-01-02' })
		);
	});

	it('builds a row signature from the chosen keys', () => {
		expect(rowSignature({ a: 1, b: 'x', c: null }, ['a', 'b', 'c'])).toBe('1|x|');
	});
});

describe('contentHash', () => {
	it('is stable for identical content and differs otherwise', async () => {
		const a = await contentHash('name,value\nx,1');
		const b = await contentHash('name,value\nx,1');
		const c = await contentHash('name,value\nx,2');
		expect(a).toBe(b);
		expect(a).not.toBe(c);
		expect(a).toHaveLength(64);
	});
});

describe('CSV export safety', () => {
	it('neutralises formula-injection payloads', () => {
		expect(sanitiseCell('=1+1')).toBe("'=1+1");
		expect(sanitiseCell('@SUM(A1)')).toBe("'@SUM(A1)");
		expect(sanitiseCell('+1')).toBe("'+1");
		expect(sanitiseCell('=cmd|/c calc')).toBe("'=cmd|/c calc");
	});

	it('leaves genuine negative numbers alone', () => {
		expect(sanitiseCell('-1250.00')).toBe('-1250.00');
		expect(sanitiseCell('-1.5e10')).toBe('-1.5e10');
	});

	it('quotes fields containing commas, quotes or newlines', () => {
		const csv = toCsv(
			[{ note: 'a,b' }, { note: 'say "hi"' }],
			[{ header: 'note', value: (r) => r.note }]
		);
		expect(csv).toContain('"a,b"');
		expect(csv).toContain('"say ""hi"""');
	});

	it('writes a header row even with no data', () => {
		expect(toCsv([], [{ header: 'name', value: () => '' }])).toBe('name\r\n');
	});
});
