import { describe, expect, it } from 'vitest';
import {
	allocationByAssetClass,
	allocationByCurrency,
	allocationByInstrument,
	concentration,
	liquidityLadder
} from '../../src/lib/engine/allocation';
import { computeNetWorth } from '../../src/lib/engine/net-worth';
import { Decimal } from '../../src/lib/engine/money';
import { RATES, asset } from './fixtures';

function portfolio() {
	return computeNetWorth(
		[
			asset({ id: 'a1', assetType: 'property', manualValue: '6000000', name: 'Home' }),
			asset({ id: 'a2', assetType: 'cash', unitPrice: '2000000', name: 'Savings' }),
			asset({ id: 'a3', assetType: 'etf', unitPrice: '2000000', name: 'World ETF', symbol: 'VWRA' })
		],
		[],
		'THB',
		RATES
	);
}

describe('allocationByAssetClass', () => {
	it('groups and computes shares that add to 100%', () => {
		const result = portfolio();
		const slices = allocationByAssetClass(result.assets, result.totalAssets);
		const total = slices.reduce((acc, s) => acc + Number(s.share!.toString()), 0);
		expect(total).toBeCloseTo(100, 8);
	});

	it('orders by the design’s class sequence, property first', () => {
		const result = portfolio();
		const slices = allocationByAssetClass(result.assets, result.totalAssets);
		expect(slices[0].key).toBe('property');
	});

	it('returns null shares for an empty portfolio rather than zeros', () => {
		const slices = allocationByAssetClass([], new Decimal(0));
		expect(slices).toEqual([]);
	});
});

describe('allocationByCurrency', () => {
	it('groups by the currency the record was entered in', () => {
		const result = computeNetWorth(
			[
				asset({ id: 'a1', currency: 'THB', unitPrice: '1000' }),
				asset({ id: 'a2', currency: 'USD', unitPrice: '100' })
			],
			[],
			'THB',
			RATES
		);
		const slices = allocationByCurrency(result.assets, result.totalAssets);
		expect(slices.map((s) => s.key).sort()).toEqual(['THB', 'USD']);
		// USD is larger once converted, so it sorts first.
		expect(slices[0].key).toBe('USD');
	});
});

describe('liquidityLadder', () => {
	it('always returns all three bands, even when empty', () => {
		const ladder = liquidityLadder([], new Decimal(0));
		expect(ladder.map((b) => b.band)).toEqual(['Liquid', 'Semi-liquid', 'Illiquid']);
		expect(ladder.every((b) => b.share === null)).toBe(true);
	});

	it('splits value across the bands', () => {
		const result = portfolio();
		const ladder = liquidityLadder(result.assets, result.totalAssets);
		const illiquid = ladder.find((b) => b.band === 'Illiquid')!;
		expect(illiquid.value.toString()).toBe('6000000');
	});
});

describe('concentration', () => {
	it('computes HHI and effective holdings for equal weights', () => {
		const result = computeNetWorth(
			[
				asset({ id: 'a1', unitPrice: '1000' }),
				asset({ id: 'a2', unitPrice: '1000' }),
				asset({ id: 'a3', unitPrice: '1000' }),
				asset({ id: 'a4', unitPrice: '1000' })
			],
			[],
			'THB',
			RATES
		);
		const conc = concentration(allocationByInstrument(result.assets, result.totalAssets));
		// Four equal holdings: HHI 0.25, effective holdings 4.
		expect(Number(conc.hhi!.toString())).toBeCloseTo(0.25, 10);
		expect(Number(conc.effectiveHoldings!.toString())).toBeCloseTo(4, 8);
		expect(Number(conc.top1Share!.toString())).toBeCloseTo(25, 8);
	});

	it('reports 100% concentration for a single holding', () => {
		const result = computeNetWorth([asset({ unitPrice: '5000' })], [], 'THB', RATES);
		const conc = concentration(allocationByInstrument(result.assets, result.totalAssets));
		expect(Number(conc.hhi!.toString())).toBeCloseTo(1, 10);
		expect(Number(conc.top1Share!.toString())).toBeCloseTo(100, 8);
	});

	it('returns nulls when there is nothing to measure', () => {
		const conc = concentration([]);
		expect(conc.hhi).toBeNull();
		expect(conc.top1Share).toBeNull();
		expect(conc.positions).toEqual([]);
	});

	it('accumulates cumulative share in weight order', () => {
		const result = portfolio();
		const conc = concentration(allocationByInstrument(result.assets, result.totalAssets));
		const last = conc.positions[conc.positions.length - 1];
		expect(Number(last.cumulative.toString())).toBeCloseTo(100, 8);
	});
});
