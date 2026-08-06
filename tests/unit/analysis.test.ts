import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SLEEVE_TARGETS,
	analyse,
	netWorthDelta,
	netWorthTrend
} from '../../src/lib/engine/analysis';
import { evaluateFindings } from '../../src/lib/engine/findings';
import { formatMoney, formatPercent } from '../../src/lib/engine/money';
import { EMPTY_RATES, RATES, asset, cashflow, liability, snapshot } from './fixtures';

const settings = {
	baseCurrency: 'THB',
	emergencyFundMonths: 6,
	sleeveTargets: DEFAULT_SLEEVE_TARGETS
};

function run(overrides: Partial<Parameters<typeof analyse>[0]> = {}) {
	return analyse({
		assets: [
			asset({ id: 'a1', assetType: 'property', manualValue: '6000000', name: 'Home' }),
			asset({ id: 'a2', assetType: 'cash', unitPrice: '600000', name: 'Savings' }),
			asset({
				id: 'a3',
				assetType: 'etf',
				symbol: 'VWRA',
				unitPrice: '1200000',
				acquisitionCost: '900000',
				accountType: 'brokerage'
			})
		],
		liabilities: [liability({ outstandingBalance: '2000000', monthlyPayment: '20000' })],
		cashflow: [
			cashflow({ id: 'i1', entryType: 'income', amount: '150000' }),
			cashflow({ id: 'e1', entryType: 'expense', category: 'living', amount: '100000' })
		],
		snapshots: [],
		rates: RATES,
		settings,
		asOf: '2026-08-01',
		...overrides
	});
}

describe('analyse', () => {
	it('produces a coherent balance sheet', () => {
		const m = run();
		expect(m.netWorth.totalAssets.toString()).toBe('7800000');
		expect(m.netWorth.totalLiabilities.toString()).toBe('2000000');
		expect(m.netWorth.netWorth.toString()).toBe('5800000');
		expect(m.isEmpty).toBe(false);
	});

	it('marks an account with no records as empty', () => {
		const m = run({ assets: [], liabilities: [], cashflow: [] });
		expect(m.isEmpty).toBe(true);
		expect(m.health.composite).not.toBeUndefined();
		expect(m.recordCount).toBe(0);
	});

	it('scopes the portfolio to investment classes only', () => {
		const m = run();
		// Only the ETF counts as an investment holding; the house and cash do not.
		expect(m.portfolio.holdings).toHaveLength(1);
		expect(m.portfolio.marketValue.toString()).toBe('1200000');
	});

	it('computes liquidity cover from liquid assets and expenses', () => {
		const m = run();
		// (600k cash + 1.2m ETF) / 100k = 18 months
		expect(m.liquidityCover?.toString()).toBe('18');
	});

	it('surfaces missing exchange rates from every source', () => {
		const m = run({
			assets: [asset({ id: 'a1', currency: 'JPY', unitPrice: '100' })],
			cashflow: [cashflow({ id: 'i1', currency: 'SGD', amount: '100' })],
			rates: EMPTY_RATES
		});
		expect(m.missingRates).toEqual(['JPY/THB', 'SGD/THB']);
	});

	it('measures concentration across the balance sheet and inside the portfolio separately', () => {
		const m = run();
		// The house dominates the balance sheet; the ETF is the only holding.
		expect(Number(m.balanceSheetConcentration.top1Share!.toString())).toBeCloseTo(
			(6000000 / 7800000) * 100,
			6
		);
		expect(Number(m.portfolioConcentration.top1Share!.toString())).toBeCloseTo(100, 6);
	});
});

describe('netWorthTrend', () => {
	it('needs at least two snapshots', () => {
		expect(netWorthTrend([])).toBeNull();
		expect(netWorthTrend([snapshot()])).toBeNull();
	});

	it('computes a percentage change', () => {
		const trend = netWorthTrend([
			snapshot({ snapshotDate: '2025-01-01', netWorth: '1000000' }),
			snapshot({ snapshotDate: '2026-01-01', netWorth: '1200000' })
		]);
		expect(trend?.toString()).toBe('20');
	});

	it('treats a move from negative toward zero as an improvement', () => {
		const trend = netWorthTrend([
			snapshot({ snapshotDate: '2025-01-01', netWorth: '-100000' }),
			snapshot({ snapshotDate: '2026-01-01', netWorth: '-50000' })
		]);
		expect(trend?.greaterThan(0)).toBe(true);
	});

	it('returns null when the first snapshot is zero', () => {
		expect(
			netWorthTrend([
				snapshot({ snapshotDate: '2025-01-01', netWorth: '0' }),
				snapshot({ snapshotDate: '2026-01-01', netWorth: '100' })
			])
		).toBeNull();
	});
});

describe('netWorthDelta', () => {
	it('is the absolute change between first and last', () => {
		expect(
			netWorthDelta([
				snapshot({ snapshotDate: '2025-01-01', netWorth: '1000000' }),
				snapshot({ snapshotDate: '2026-01-01', netWorth: '1200000' })
			])?.toString()
		).toBe('200000');
	});
});

describe('findings', () => {
	const formatters = {
		money: (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, 'THB', { decimals: 0 }),
		percent: (v: Parameters<typeof formatPercent>[0], decimals = 1) =>
			formatPercent(v, { decimals }),
		number: (v: { toFixed: (n: number) => string }, decimals = 2) => v.toFixed(decimals)
	};

	it('fires the expensive-debt rule for a high-rate balance', () => {
		const m = run({
			liabilities: [
				liability({
					id: 'l1',
					name: 'Credit card',
					liabilityType: 'credit_card',
					outstandingBalance: '48000',
					interestRate: '18.9',
					monthlyPayment: '4800'
				})
			]
		});
		const findings = evaluateFindings(m, formatters);
		expect(findings.some((f) => f.id === 'expensive-debt')).toBe(true);
	});

	it('orders findings by severity, act-now first', () => {
		const m = run({
			liabilities: [
				liability({
					id: 'l1',
					name: 'Credit card',
					liabilityType: 'credit_card',
					outstandingBalance: '48000',
					interestRate: '18.9',
					monthlyPayment: '4800'
				})
			]
		});
		const findings = evaluateFindings(m, formatters);
		expect(findings[0].severity).toBe('Act now');
	});

	it('fires the negative-cash-flow rule when outgoings exceed income', () => {
		const m = run({
			cashflow: [
				cashflow({ id: 'i1', entryType: 'income', amount: '50000' }),
				cashflow({ id: 'e1', entryType: 'expense', category: 'living', amount: '80000' })
			]
		});
		expect(evaluateFindings(m, formatters).some((f) => f.id === 'negative-cashflow')).toBe(true);
	});

	it('reports missing exchange rates as a finding', () => {
		const m = run({
			assets: [asset({ id: 'a1', currency: 'JPY', unitPrice: '100' })],
			rates: EMPTY_RATES
		});
		expect(evaluateFindings(m, formatters).some((f) => f.id === 'missing-rates')).toBe(true);
	});

	it('produces no findings from an empty account rather than inventing problems', () => {
		const m = run({ assets: [], liabilities: [], cashflow: [] });
		const findings = evaluateFindings(m, formatters);
		expect(findings.every((f) => f.severity !== 'Act now')).toBe(true);
	});
});
