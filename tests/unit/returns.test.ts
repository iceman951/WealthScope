import { describe, expect, it } from 'vitest';
import {
	annualisedReturn,
	daysBetween,
	investmentIncome,
	portfolioReturn,
	realisedGains,
	sleeveWeights,
	totalReturn,
	transactionRate
} from '../../src/lib/engine/returns';
import { Decimal } from '../../src/lib/engine/money';
import { computeNetWorth } from '../../src/lib/engine/net-worth';
import { EMPTY_RATES, RATES, asset, transaction } from './fixtures';

/**
 * The portfolio is denominated in THB and RATES carries USD/THB at 36.5. Trades
 * already in THB take the equal-currency path, so their arithmetic is unaffected
 * by conversion — which is what keeps the single-currency expectations below
 * exactly as they were before rates entered this module.
 */
const THB = { baseCurrency: 'THB', rates: RATES };

function holdings() {
	return computeNetWorth(
		[
			asset({
				id: 'a1',
				assetType: 'etf',
				symbol: 'VWRA',
				unitPrice: '1000',
				acquisitionCost: '800'
			}),
			asset({
				id: 'a2',
				assetType: 'bond',
				symbol: 'AGGU',
				unitPrice: '500',
				acquisitionCost: '600'
			})
		],
		[],
		'THB',
		RATES
	).assets;
}

describe('portfolioReturn', () => {
	it('computes unrealised gain and percentage', () => {
		const result = portfolioReturn(holdings());
		expect(result.marketValue.toString()).toBe('1500');
		expect(result.costBasis.toString()).toBe('1400');
		expect(result.unrealisedGain.toString()).toBe('100');
		expect(Number(result.unrealisedReturn!.toString())).toBeCloseTo(7.142857, 5);
	});

	it('flags a partial cost basis rather than treating missing cost as zero', () => {
		const partial = computeNetWorth(
			[
				asset({ id: 'a1', assetType: 'etf', unitPrice: '1000', acquisitionCost: '800' }),
				asset({ id: 'a2', assetType: 'etf', unitPrice: '500', acquisitionCost: null })
			],
			[],
			'THB',
			RATES
		).assets;
		const result = portfolioReturn(partial);
		expect(result.costBasisIncomplete).toBe(true);
		expect(result.holdings[1].unrealisedReturn).toBeNull();
	});

	it('returns a null percentage with no cost basis at all', () => {
		const none = computeNetWorth(
			[asset({ id: 'a1', assetType: 'etf', unitPrice: '1000', acquisitionCost: null })],
			[],
			'THB',
			RATES
		).assets;
		expect(portfolioReturn(none).unrealisedReturn).toBeNull();
	});

	it('handles an empty portfolio', () => {
		const result = portfolioReturn([]);
		expect(result.marketValue.toString()).toBe('0');
		expect(result.unrealisedReturn).toBeNull();
	});

	it('reports a loss as a negative return', () => {
		const result = portfolioReturn(holdings());
		expect(result.holdings[1].unrealisedGain?.toString()).toBe('-100');
	});
});

describe('realisedGains', () => {
	it('matches sales to purchases FIFO', () => {
		const result = realisedGains(
			[
				transaction({ id: 't1', transactionType: 'buy', quantity: '10', grossAmount: '1000' }),
				transaction({
					id: 't2',
					transactionType: 'buy',
					quantity: '10',
					grossAmount: '1400',
					transactionDate: '2025-06-01'
				}),
				transaction({
					id: 't3',
					transactionType: 'sell',
					quantity: '10',
					grossAmount: '1500',
					transactionDate: '2025-12-01'
				})
			],
			THB
		);
		// The first lot cost 100/unit; selling 10 at 150 realises 500.
		expect(result.realisedGain.toString()).toBe('500');
		expect(result.unmatchedSales).toBe(0);
	});

	it('includes acquisition fees in the lot cost and disposal fees in proceeds', () => {
		const result = realisedGains(
			[
				transaction({
					id: 't1',
					transactionType: 'buy',
					quantity: '10',
					grossAmount: '1000',
					feeAmount: '20'
				}),
				transaction({
					id: 't2',
					transactionType: 'sell',
					quantity: '10',
					grossAmount: '1500',
					feeAmount: '30',
					transactionDate: '2025-12-01'
				})
			],
			THB
		);
		// (1500 − 30) − (1000 + 20) = 450
		expect(result.realisedGain.toString()).toBe('450');
	});

	it('reports a sale with no matching purchase instead of inventing a basis', () => {
		const result = realisedGains(
			[transaction({ id: 't1', transactionType: 'sell', quantity: '5', grossAmount: '600' })],
			THB
		);
		expect(result.unmatchedSales).toBe(1);
	});

	it('is zero for an account with no trades', () => {
		expect(realisedGains([], THB).realisedGain.toString()).toBe('0');
	});
});

describe('investmentIncome', () => {
	it('separates dividends, interest, fees and tax', () => {
		const result = investmentIncome(
			[
				transaction({ id: 'd1', transactionType: 'dividend', grossAmount: '400' }),
				transaction({ id: 'i1', transactionType: 'interest', grossAmount: '100' }),
				transaction({ id: 'f1', transactionType: 'fee', grossAmount: '25' }),
				transaction({ id: 'x1', transactionType: 'tax', grossAmount: '75' })
			],
			THB
		);
		expect(result.dividends.toString()).toBe('400');
		expect(result.interest.toString()).toBe('100');
		expect(result.total.toString()).toBe('400'); // 500 − 25 − 75
	});

	it('converts foreign income at the rate table', () => {
		const result = investmentIncome(
			[transaction({ id: 'd1', transactionType: 'dividend', grossAmount: '100', currency: 'USD' })],
			THB
		);
		expect(result.dividends.toString()).toBe('3650'); // 100 USD at 36.5
		expect(result.missingRates).toEqual([]);
		expect(result.appliedRates).toEqual({ 'USD/THB': '36.5' });
	});
});

describe('realisedGains across currencies', () => {
	function usdTrades(overrides: { buyRate?: string | null; sellRate?: string | null } = {}) {
		return [
			transaction({
				id: 't1',
				transactionType: 'buy',
				quantity: '10',
				grossAmount: '1000',
				currency: 'USD',
				exchangeRate: overrides.buyRate ?? null
			}),
			transaction({
				id: 't2',
				transactionType: 'sell',
				quantity: '10',
				grossAmount: '1500',
				currency: 'USD',
				transactionDate: '2025-12-01',
				exchangeRate: overrides.sellRate ?? null
			})
		];
	}

	it('converts to the base currency before matching lots', () => {
		const result = realisedGains(usdTrades(), THB);
		// (1500 − 1000) USD at 36.5 = 18,250 THB.
		expect(result.realisedGain.toString()).toBe('18250');
		expect(result.missingRates).toEqual([]);
		expect(result.excludedTransactions).toBe(0);
	});

	it('prefers the rate recorded against the transaction over the rate table', () => {
		const result = realisedGains(usdTrades({ buyRate: '30', sellRate: '36.5' }), THB);
		// Bought at 30: cost 30,000. Sold at 36.5: proceeds 54,750. Gain 24,750.
		// The FX move is part of the realised gain, which is the point of storing
		// a dated rate rather than revaluing both legs at today's.
		expect(result.realisedGain.toString()).toBe('24750');
	});

	it('excludes and reports a trade whose rate cannot be resolved', () => {
		const result = realisedGains(usdTrades(), { baseCurrency: 'THB', rates: EMPTY_RATES });
		expect(result.missingRates).toEqual(['USD/THB']);
		expect(result.excludedTransactions).toBe(2);
		// Nothing invented: no lot opened, no proceeds counted.
		expect(result.realisedGain.toString()).toBe('0');
		expect(result.unmatchedSales).toBe(0);
	});

	it('ignores a malformed stored rate rather than treating it as zero', () => {
		const result = realisedGains(usdTrades({ buyRate: 'not-a-number', sellRate: '0' }), THB);
		// Both fall through to the table at 36.5, as if no rate had been stored.
		expect(result.realisedGain.toString()).toBe('18250');
	});
});

describe('totalReturn', () => {
	it('adds unrealised, realised and income', () => {
		const portfolio = portfolioReturn(holdings());
		const result = totalReturn(
			portfolio,
			{
				realisedGain: new Decimal(200),
				unmatchedSales: 0,
				proceeds: new Decimal(0),
				costOfSales: new Decimal(0),
				missingRates: [],
				excludedTransactions: 0,
				appliedRates: {}
			},
			{
				dividends: new Decimal(50),
				interest: new Decimal(0),
				fees: new Decimal(0),
				taxes: new Decimal(0),
				total: new Decimal(50),
				missingRates: [],
				excludedTransactions: 0,
				appliedRates: {}
			}
		);
		expect(result.total.toString()).toBe('350'); // 100 + 200 + 50
		expect(result.incomplete).toBe(false);
	});

	it('marks the total incomplete when a side could not be converted', () => {
		const portfolio = portfolioReturn(holdings());
		const result = totalReturn(
			portfolio,
			{
				realisedGain: new Decimal(200),
				unmatchedSales: 0,
				proceeds: new Decimal(0),
				costOfSales: new Decimal(0),
				missingRates: ['SGD/THB'],
				excludedTransactions: 1,
				appliedRates: {}
			},
			{
				dividends: new Decimal(0),
				interest: new Decimal(0),
				fees: new Decimal(0),
				taxes: new Decimal(0),
				total: new Decimal(0),
				missingRates: ['USD/THB'],
				excludedTransactions: 2,
				appliedRates: {}
			}
		);
		expect(result.incomplete).toBe(true);
		expect(result.missingRates).toEqual(['SGD/THB', 'USD/THB']);
	});
});

describe('transactionRate', () => {
	it('needs no rate when the trade is already in the base currency', () => {
		const result = transactionRate(transaction({ currency: 'THB' }), THB);
		expect(result.ok && result.rate.toString()).toBe('1');
	});

	it('uses the stored rate when there is one', () => {
		const result = transactionRate(transaction({ currency: 'USD', exchangeRate: '32' }), THB);
		expect(result.ok && result.rate.toString()).toBe('32');
	});

	it('falls back to the rate table', () => {
		const result = transactionRate(transaction({ currency: 'USD' }), THB);
		expect(result.ok && result.rate.toString()).toBe('36.5');
	});

	it('reports the pair it could not resolve', () => {
		const result = transactionRate(transaction({ currency: 'SGD' }), THB);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.missing).toBe('SGD/THB');
	});
});

describe('annualisedReturn', () => {
	it('computes CAGR over a valid period', () => {
		const result = annualisedReturn(
			new Decimal(1000),
			new Decimal(1210),
			'2024-01-01',
			'2026-01-01'
		);
		expect(Number(result!.toString())).toBeCloseTo(10, 1);
	});

	it('refuses to quote a figure over less than a month', () => {
		expect(
			annualisedReturn(new Decimal(1000), new Decimal(1100), '2026-01-01', '2026-01-15')
		).toBeNull();
	});

	it('refuses a non-positive start or end value', () => {
		expect(
			annualisedReturn(new Decimal(0), new Decimal(1000), '2024-01-01', '2026-01-01')
		).toBeNull();
		expect(
			annualisedReturn(new Decimal(1000), new Decimal(0), '2024-01-01', '2026-01-01')
		).toBeNull();
	});

	it('refuses a reversed date range', () => {
		expect(
			annualisedReturn(new Decimal(1000), new Decimal(1100), '2026-01-01', '2024-01-01')
		).toBeNull();
	});
});

describe('daysBetween', () => {
	it('counts inclusive calendar days forward only', () => {
		expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
		expect(daysBetween('2026-01-31', '2026-01-01')).toBeNull();
		expect(daysBetween('nonsense', '2026-01-01')).toBeNull();
	});
});

describe('sleeveWeights', () => {
	it('computes drift against a target', () => {
		const portfolio = portfolioReturn(holdings());
		const weights = sleeveWeights(portfolio.holdings, { Equities: 55, Bonds: 20 });
		const equities = weights.find((w) => w.sleeve === 'Equities')!;
		// 1000 of 1500 is 66.67%, against a 55% target: about 11.67pp of drift.
		expect(Number(equities.drift!.toString())).toBeCloseTo(11.6667, 3);
	});

	it('includes a target sleeve the portfolio does not hold', () => {
		const portfolio = portfolioReturn(holdings());
		const weights = sleeveWeights(portfolio.holdings, { Commodities: 8 });
		const commodities = weights.find((w) => w.sleeve === 'Commodities')!;
		expect(commodities.actual?.toString()).toBe('0');
		expect(Number(commodities.drift!.toString())).toBeCloseTo(-8, 8);
	});

	it('returns null weights for an empty portfolio', () => {
		const weights = sleeveWeights([], { Equities: 55 });
		expect(weights[0].actual).toBeNull();
		expect(weights[0].drift).toBeNull();
	});
});
