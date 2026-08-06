import { describe, expect, it } from 'vitest';
import {
	MIN_CORRELATION_OVERLAP,
	MIN_OBSERVATIONS,
	correlation,
	correlationMatrix,
	currencyExposure,
	maxDrawdown,
	mean,
	periodReturns,
	runStressTests,
	sharpeRatio,
	standardDeviation,
	volatility
} from '../../src/lib/engine/risk';
import { Decimal } from '../../src/lib/engine/money';
import { computeNetWorth } from '../../src/lib/engine/net-worth';
import { RATES, asset, prices } from './fixtures';

describe('periodReturns', () => {
	it('computes simple returns between consecutive prices', () => {
		const returns = periodReturns([
			{ priceDate: '2026-01-01', price: '100', currency: 'USD' },
			{ priceDate: '2026-02-01', price: '110', currency: 'USD' }
		]);
		expect(returns).toHaveLength(1);
		expect(returns[0].toString()).toBe('0.1');
	});

	it('sorts by date before differencing', () => {
		const returns = periodReturns([
			{ priceDate: '2026-02-01', price: '110', currency: 'USD' },
			{ priceDate: '2026-01-01', price: '100', currency: 'USD' }
		]);
		expect(returns[0].toString()).toBe('0.1');
	});

	it('skips a zero previous price rather than dividing by it', () => {
		const returns = periodReturns([
			{ priceDate: '2026-01-01', price: '0', currency: 'USD' },
			{ priceDate: '2026-02-01', price: '110', currency: 'USD' }
		]);
		expect(returns).toHaveLength(0);
	});
});

describe('standardDeviation / mean', () => {
	it('needs at least two observations', () => {
		expect(standardDeviation([new Decimal(1)])).toBeNull();
		expect(mean([])).toBeNull();
	});

	it('is zero for a constant series', () => {
		expect(standardDeviation([new Decimal(2), new Decimal(2), new Decimal(2)])?.toString()).toBe(
			'0'
		);
	});
});

describe('volatility', () => {
	it('publishes nothing below the minimum observation count', () => {
		const result = volatility(prices(100, 10));
		expect(result.annualised).toBeNull();
		expect(result.quality.sufficient).toBe(false);
		expect(result.quality.observations).toBe(9);
	});

	it('publishes a figure once there is enough history', () => {
		const result = volatility(prices(100, MIN_OBSERVATIONS + 2));
		expect(result.quality.sufficient).toBe(true);
		expect(result.annualised).not.toBeNull();
		expect(result.annualised!.greaterThan(0)).toBe(true);
	});

	it('reports no volatility for an empty series', () => {
		const result = volatility([]);
		expect(result.annualised).toBeNull();
		expect(result.quality.observations).toBe(0);
	});
});

describe('maxDrawdown', () => {
	it('finds the largest peak-to-trough fall', () => {
		const result = maxDrawdown([
			{ priceDate: '2026-01-01', price: '100', currency: 'USD' },
			{ priceDate: '2026-02-01', price: '120', currency: 'USD' },
			{ priceDate: '2026-03-01', price: '90', currency: 'USD' },
			{ priceDate: '2026-04-01', price: '110', currency: 'USD' }
		]);
		// 120 → 90 is −25%.
		expect(Number(result.maxDrawdown!.toString())).toBeCloseTo(-25, 8);
		expect(result.peakDate).toBe('2026-02-01');
		expect(result.troughDate).toBe('2026-03-01');
	});

	it('is zero for a monotonically rising series', () => {
		const result = maxDrawdown([
			{ priceDate: '2026-01-01', price: '100', currency: 'USD' },
			{ priceDate: '2026-02-01', price: '110', currency: 'USD' }
		]);
		expect(result.maxDrawdown!.toString()).toBe('0');
	});

	it('needs at least two observations', () => {
		expect(
			maxDrawdown([{ priceDate: '2026-01-01', price: '100', currency: 'USD' }]).maxDrawdown
		).toBeNull();
	});
});

describe('correlation', () => {
	it('returns null below the overlap threshold instead of a noisy number', () => {
		const result = correlation(prices(100, 5), prices(50, 5));
		expect(result.value).toBeNull();
		expect(result.sufficient).toBe(false);
	});

	it('reports 1 for two identical series', () => {
		const series = prices(100, MIN_CORRELATION_OVERLAP + 5);
		const result = correlation(series, series);
		expect(result.sufficient).toBe(true);
		expect(Number(result.value!.toString())).toBeCloseTo(1, 6);
	});
});

describe('correlationMatrix', () => {
	it('puts 1 on the diagonal and marks incompleteness', () => {
		const matrix = correlationMatrix([
			{ label: 'A', points: prices(100, 4) },
			{ label: 'B', points: prices(50, 4) }
		]);
		expect(matrix.cells[0][0].value?.toString()).toBe('1');
		expect(matrix.complete).toBe(false);
	});

	it('is empty and incomplete with no series', () => {
		const matrix = correlationMatrix([]);
		expect(matrix.labels).toEqual([]);
		expect(matrix.complete).toBe(false);
	});
});

describe('sharpeRatio', () => {
	it('requires an explicit risk-free rate', () => {
		expect(sharpeRatio(new Decimal(10), new Decimal(12), null)).toBeNull();
	});

	it('returns null without a volatility figure', () => {
		expect(sharpeRatio(new Decimal(10), null, new Decimal(2))).toBeNull();
	});

	it('computes the ratio when everything is supplied', () => {
		expect(sharpeRatio(new Decimal(10), new Decimal(20), new Decimal(2))?.toString()).toBe('0.4');
	});

	it('returns null on zero volatility rather than dividing by it', () => {
		expect(sharpeRatio(new Decimal(10), new Decimal(0), new Decimal(2))).toBeNull();
	});
});

describe('currencyExposure', () => {
	it('groups by entry currency and orders by size', () => {
		const result = computeNetWorth(
			[
				asset({ id: 'a1', currency: 'THB', unitPrice: '1000' }),
				asset({ id: 'a2', currency: 'USD', unitPrice: '100' })
			],
			[],
			'THB',
			RATES
		);
		const exposure = currencyExposure(result.assets, result.totalAssets);
		expect(exposure[0].currency).toBe('USD');
		expect(Number(exposure[0].share!.toString())).toBeCloseTo((3650 / 4650) * 100, 6);
	});
});

describe('runStressTests', () => {
	it('applies each shock to the matching exposure', () => {
		const results = runStressTests({
			equity: new Decimal(1000),
			portfolio: new Decimal(1500),
			bond: new Decimal(400),
			property: new Decimal(6000)
		});
		const equityShock = results.find((r) => r.scenario.id === 'equity-30')!;
		expect(equityShock.impact.toString()).toBe('-300');
		const houseShock = results.find((r) => r.scenario.id === 'house-15')!;
		expect(houseShock.impact.toString()).toBe('-900');
	});

	it('is zero across the board for an empty balance sheet', () => {
		const results = runStressTests({
			equity: new Decimal(0),
			portfolio: new Decimal(0),
			bond: new Decimal(0),
			property: new Decimal(0)
		});
		expect(results.every((r) => r.impact.isZero())).toBe(true);
	});
});
