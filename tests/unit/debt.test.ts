import { describe, expect, it } from 'vitest';
import {
	amortise,
	avalanchePlan,
	computeDebtMetrics,
	formatTerm,
	rateBarFraction
} from '../../src/lib/engine/debt';
import { Decimal } from '../../src/lib/engine/money';
import { computeNetWorth } from '../../src/lib/engine/net-worth';
import { RATES, liability } from './fixtures';

function converted(liabilities: ReturnType<typeof liability>[]) {
	return computeNetWorth([], liabilities, 'THB', RATES).liabilities;
}

describe('computeDebtMetrics', () => {
	it('totals debt and monthly payments', () => {
		const metrics = computeDebtMetrics(
			converted([
				liability({ id: 'l1', outstandingBalance: '400000', monthlyPayment: '6000' }),
				liability({ id: 'l2', outstandingBalance: '100000', monthlyPayment: '2000' })
			]),
			new Decimal(1_000_000),
			new Decimal(50_000)
		);
		expect(metrics.totalDebt.toString()).toBe('500000');
		expect(metrics.monthlyDebtPayment.toString()).toBe('8000');
	});

	it('weights the average rate by balance', () => {
		const metrics = computeDebtMetrics(
			converted([
				liability({ id: 'l1', outstandingBalance: '900000', interestRate: '3' }),
				liability({ id: 'l2', outstandingBalance: '100000', interestRate: '18' })
			]),
			new Decimal(1_000_000),
			new Decimal(50_000)
		);
		// (900k×3 + 100k×18) / 1M = 4.5
		expect(metrics.weightedAverageRate?.toString()).toBe('4.5');
	});

	it('returns nulls rather than zeros when there is no debt', () => {
		const metrics = computeDebtMetrics([], new Decimal(1_000_000), new Decimal(50_000));
		expect(metrics.totalDebt.toString()).toBe('0');
		expect(metrics.weightedAverageRate).toBeNull();
		expect(metrics.debtToAssets?.toString()).toBe('0');
	});

	it('returns a null debt-to-assets ratio when there are no assets', () => {
		const metrics = computeDebtMetrics(
			converted([liability({ outstandingBalance: '100000' })]),
			new Decimal(0),
			new Decimal(50_000)
		);
		expect(metrics.debtToAssets).toBeNull();
	});

	it('returns a null debt-service ratio without income', () => {
		const metrics = computeDebtMetrics(
			converted([liability({ monthlyPayment: '6000' })]),
			new Decimal(1_000_000),
			new Decimal(0)
		);
		expect(metrics.debtServiceRatio).toBeNull();
	});

	it('orders payoff by rate, highest first', () => {
		const metrics = computeDebtMetrics(
			converted([
				liability({ id: 'l1', name: 'Mortgage', interestRate: '3.4' }),
				liability({ id: 'l2', name: 'Card', interestRate: '18.9', liabilityType: 'credit_card' }),
				liability({ id: 'l3', name: 'Car', interestRate: '6.9', liabilityType: 'auto_loan' })
			]),
			new Decimal(1_000_000),
			new Decimal(50_000)
		);
		expect(metrics.payoffOrder.map((p) => p.name)).toEqual(['Card', 'Car', 'Mortgage']);
	});

	it('groups liabilities as secured, unsecured or revolving', () => {
		const metrics = computeDebtMetrics(
			converted([
				liability({ id: 'l1', liabilityType: 'mortgage' }),
				liability({ id: 'l2', liabilityType: 'credit_card' }),
				liability({ id: 'l3', liabilityType: 'student_loan' })
			]),
			new Decimal(1_000_000),
			new Decimal(50_000)
		);
		expect(metrics.positions.map((p) => p.group)).toEqual(['Secured', 'Revolving', 'Unsecured']);
	});
});

describe('amortise', () => {
	it('clears a zero-rate loan in exactly the expected number of months', () => {
		const result = amortise(new Decimal(1200), new Decimal(0), new Decimal(100));
		expect(result.monthsToPayoff).toBe(12);
		expect(result.totalInterest.toString()).toBe('0');
	});

	it('charges interest on the reducing balance', () => {
		const result = amortise(new Decimal(100000), new Decimal(12), new Decimal(10000));
		expect(result.monthsToPayoff).toBeGreaterThan(10);
		expect(result.totalInterest.greaterThan(0)).toBe(true);
		// Every month pays down some principal.
		expect(result.schedule.every((point) => point.principal.greaterThan(0))).toBe(true);
	});

	it('flags a payment that does not even cover the interest', () => {
		const result = amortise(new Decimal(100000), new Decimal(24), new Decimal(500));
		expect(result.neverAmortises).toBe(true);
		expect(result.monthsToPayoff).toBeNull();
	});

	it('treats a zero payment as never amortising', () => {
		const result = amortise(new Decimal(1000), new Decimal(5), new Decimal(0));
		expect(result.neverAmortises).toBe(true);
	});

	it('returns immediately for a cleared balance', () => {
		const result = amortise(new Decimal(0), new Decimal(5), new Decimal(100));
		expect(result.monthsToPayoff).toBe(0);
	});
});

describe('formatTerm', () => {
	it('formats months, years and the revolving case', () => {
		expect(formatTerm(6, false)).toBe('6 mo');
		expect(formatTerm(24, false)).toBe('2 yr');
		expect(formatTerm(30, false)).toBe('2.5 yr');
		expect(formatTerm(null, true)).toBe('Revolving');
		expect(formatTerm(null, false)).toBe('—');
	});
});

describe('avalanchePlan', () => {
	it('ranks by rate and reports when each clears', () => {
		const metrics = computeDebtMetrics(
			converted([
				liability({
					id: 'l1',
					name: 'Card',
					liabilityType: 'credit_card',
					outstandingBalance: '48000',
					interestRate: '18.9',
					monthlyPayment: '4800'
				}),
				liability({
					id: 'l2',
					name: 'Mortgage',
					outstandingBalance: '4180000',
					interestRate: '3.4',
					monthlyPayment: '31200'
				})
			]),
			new Decimal(10_000_000),
			new Decimal(150_000)
		);
		const plan = avalanchePlan(metrics.positions);
		expect(plan[0].name).toBe('Card');
		expect(plan[0].rank).toBe(1);
		expect(plan[0].clearedInMonth).toBeGreaterThan(0);
	});
});

describe('rateBarFraction', () => {
	it('scales against a 20% ceiling and clamps', () => {
		expect(rateBarFraction(new Decimal(10)).toString()).toBe('50');
		expect(rateBarFraction(new Decimal(40)).toString()).toBe('100');
	});
});
