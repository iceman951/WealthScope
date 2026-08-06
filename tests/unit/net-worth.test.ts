import { describe, expect, it } from 'vitest';
import { assetNativeValue, computeNetWorth } from '../../src/lib/engine/net-worth';
import { EMPTY_RATES, RATES, asset, liability } from './fixtures';

describe('assetNativeValue', () => {
	it('multiplies quantity by unit price', () => {
		expect(
			assetNativeValue({ quantity: '10', unitPrice: '25.5', manualValue: null }).toString()
		).toBe('255');
	});

	it('lets a manual valuation win, which is what a house needs', () => {
		expect(
			assetNativeValue({ quantity: '1', unitPrice: '0', manualValue: '8400000' }).toString()
		).toBe('8400000');
	});

	it('treats an empty manual value as absent', () => {
		expect(assetNativeValue({ quantity: '2', unitPrice: '3', manualValue: '' }).toString()).toBe(
			'6'
		);
	});
});

describe('computeNetWorth', () => {
	it('is assets less liabilities', () => {
		const result = computeNetWorth(
			[asset({ unitPrice: '1000000' })],
			[liability({ outstandingBalance: '400000' })],
			'THB',
			RATES
		);
		expect(result.totalAssets.toString()).toBe('1000000');
		expect(result.totalLiabilities.toString()).toBe('400000');
		expect(result.netWorth.toString()).toBe('600000');
	});

	it('handles an empty portfolio without dividing by anything', () => {
		const result = computeNetWorth([], [], 'THB', EMPTY_RATES);
		expect(result.netWorth.toString()).toBe('0');
		expect(result.assets).toEqual([]);
		expect(result.missingRates).toEqual([]);
	});

	it('goes negative when debt exceeds assets', () => {
		const result = computeNetWorth(
			[asset({ unitPrice: '100000' })],
			[liability({ outstandingBalance: '250000' })],
			'THB',
			RATES
		);
		expect(result.netWorth.toString()).toBe('-150000');
	});

	it('converts mixed currencies into the base currency', () => {
		const result = computeNetWorth(
			[
				asset({ id: 'a1', currency: 'THB', unitPrice: '1000' }),
				asset({ id: 'a2', currency: 'USD', unitPrice: '100' })
			],
			[],
			'THB',
			RATES
		);
		// 1000 THB + (100 USD × 36.5) = 4650 THB
		expect(result.totalAssets.toString()).toBe('4650');
		expect(result.appliedRates['USD/THB']).toBe('36.5');
	});

	it('excludes a row with no resolvable rate and names the missing pair', () => {
		const result = computeNetWorth(
			[
				asset({ id: 'a1', currency: 'THB', unitPrice: '1000' }),
				asset({ id: 'a2', currency: 'JPY', unitPrice: '50000' })
			],
			[],
			'THB',
			RATES
		);
		expect(result.totalAssets.toString()).toBe('1000');
		expect(result.missingRates).toEqual(['JPY/THB']);
		expect(result.assets).toHaveLength(1);
	});

	it('classifies liquidity from the asset type and its account', () => {
		const result = computeNetWorth(
			[
				asset({ id: 'a1', assetType: 'etf', accountType: 'brokerage' }),
				asset({ id: 'a2', assetType: 'etf', accountType: 'retirement' }),
				asset({ id: 'a3', assetType: 'property', accountType: null })
			],
			[],
			'THB',
			RATES
		);
		expect(result.assets.map((a) => a.liquidity)).toEqual(['Liquid', 'Illiquid', 'Illiquid']);
	});

	it('counts only liquid holdings toward liquid assets', () => {
		const result = computeNetWorth(
			[
				asset({ id: 'a1', assetType: 'cash', unitPrice: '500' }),
				asset({ id: 'a2', assetType: 'property', unitPrice: '900000', manualValue: '900000' })
			],
			[],
			'THB',
			RATES
		);
		expect(result.liquidAssets.toString()).toBe('500');
	});

	it('converts the cost basis with the same rate as the value', () => {
		const result = computeNetWorth(
			[asset({ currency: 'USD', unitPrice: '100', acquisitionCost: '80' })],
			[],
			'THB',
			RATES
		);
		expect(result.assets[0].baseCost?.toString()).toBe('2920'); // 80 × 36.5
	});

	it('uses the monthly payment, falling back to the minimum', () => {
		const result = computeNetWorth(
			[],
			[
				liability({ id: 'l1', monthlyPayment: '6000', minimumPayment: '3000' }),
				liability({ id: 'l2', monthlyPayment: null, minimumPayment: '2500' })
			],
			'THB',
			RATES
		);
		expect(result.liabilities[0].baseMonthlyPayment.toString()).toBe('6000');
		expect(result.liabilities[1].baseMonthlyPayment.toString()).toBe('2500');
	});
});
