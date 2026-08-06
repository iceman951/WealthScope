import { describe, expect, it } from 'vitest';
import {
	buildRateTable,
	convert,
	convertAll,
	rateKey,
	resolveRate
} from '../../src/lib/engine/currency';

const rates = buildRateTable([
	{ baseCurrency: 'USD', quoteCurrency: 'THB', rate: '36.5', rateDate: '2026-08-01' },
	{ baseCurrency: 'EUR', quoteCurrency: 'USD', rate: '1.08', rateDate: '2026-08-01' }
]);

describe('buildRateTable', () => {
	it('keeps the most recent observation for a pair', () => {
		const table = buildRateTable([
			{ baseCurrency: 'USD', quoteCurrency: 'THB', rate: '35', rateDate: '2026-01-01' },
			{ baseCurrency: 'USD', quoteCurrency: 'THB', rate: '36.5', rateDate: '2026-08-01' }
		]);
		expect(table.get(rateKey('USD', 'THB'))?.rate.toString()).toBe('36.5');
	});

	it('rejects non-positive rates', () => {
		const table = buildRateTable([
			{ baseCurrency: 'USD', quoteCurrency: 'THB', rate: '0', rateDate: '2026-08-01' },
			{ baseCurrency: 'GBP', quoteCurrency: 'THB', rate: '-5', rateDate: '2026-08-01' }
		]);
		expect(table.size).toBe(0);
	});
});

describe('resolveRate', () => {
	it('returns 1 for the same currency', () => {
		expect(resolveRate('THB', 'THB', rates)?.rate.toString()).toBe('1');
	});

	it('resolves a direct pair', () => {
		expect(resolveRate('USD', 'THB', rates)?.rate.toString()).toBe('36.5');
	});

	it('inverts a pair recorded the other way round', () => {
		const inverted = resolveRate('THB', 'USD', rates);
		expect(inverted).not.toBeNull();
		expect(Number(inverted!.rate.toString())).toBeCloseTo(1 / 36.5, 10);
	});

	it('triangulates through a pivot currency', () => {
		// EUR→USD 1.08 and USD→THB 36.5 gives EUR→THB 39.42.
		expect(resolveRate('EUR', 'THB', rates)?.rate.toString()).toBe('39.42');
	});

	it('returns null when no path exists', () => {
		expect(resolveRate('JPY', 'THB', rates)).toBeNull();
	});
});

describe('convert', () => {
	it('converts exactly', () => {
		const result = convert('100', 'USD', 'THB', rates);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.toString()).toBe('3650');
	});

	it('reports the missing pair instead of guessing', () => {
		const result = convert('100', 'JPY', 'THB', rates);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.missing).toBe('JPY/THB');
	});

	it('is a no-op for the base currency', () => {
		const result = convert('12.34', 'THB', 'THB', rates);
		expect(result.ok && result.value.toString()).toBe('12.34');
	});
});

describe('convertAll', () => {
	it('sums mixed currencies into one base', () => {
		const result = convertAll(
			[
				{ amount: '1000', currency: 'THB' },
				{ amount: '100', currency: 'USD' }
			],
			'THB',
			rates
		);
		expect(result.total.toString()).toBe('4650');
		expect(result.missingRates).toEqual([]);
		expect(result.appliedRates['USD/THB']).toBe('36.5');
	});

	it('excludes unresolvable rows and names the pair', () => {
		const result = convertAll(
			[
				{ amount: '1000', currency: 'THB' },
				{ amount: '500', currency: 'JPY' }
			],
			'THB',
			rates
		);
		// The JPY row is excluded, not silently counted as 500 THB.
		expect(result.total.toString()).toBe('1000');
		expect(result.missingRates).toEqual(['JPY/THB']);
	});

	it('returns zero for an empty portfolio', () => {
		const result = convertAll([], 'THB', rates);
		expect(result.total.toString()).toBe('0');
	});
});
