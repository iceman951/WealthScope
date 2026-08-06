import { describe, expect, it } from 'vitest';
import {
	computeCashflow,
	emergencyCover,
	isActiveOn,
	monthlyAmount,
	trailingMonthlyFlow
} from '../../src/lib/engine/cashflow';
import { Decimal } from '../../src/lib/engine/money';
import { RATES, cashflow } from './fixtures';

describe('monthlyAmount', () => {
	it('converts each frequency to a monthly figure', () => {
		expect(
			monthlyAmount({ amount: '1200', frequency: 'monthly', isRecurring: true }).toString()
		).toBe('1200');
		expect(
			monthlyAmount({ amount: '1200', frequency: 'annual', isRecurring: true }).toString()
		).toBe('100');
		expect(
			monthlyAmount({ amount: '300', frequency: 'quarterly', isRecurring: true }).toString()
		).toBe('100');
		// 100 × 52 ÷ 12 recurs; compare numerically rather than to a fixed digit count.
		expect(
			Number(monthlyAmount({ amount: '100', frequency: 'weekly', isRecurring: true }).toString())
		).toBeCloseTo(433.3333, 4);
	});

	it('contributes nothing for a one-off entry', () => {
		expect(
			monthlyAmount({ amount: '5000', frequency: 'once', isRecurring: false }).toString()
		).toBe('0');
		expect(
			monthlyAmount({ amount: '5000', frequency: 'monthly', isRecurring: false }).toString()
		).toBe('0');
	});
});

describe('isActiveOn', () => {
	it('excludes entries that have not started', () => {
		expect(isActiveOn({ entryDate: '2027-01-01', endDate: null }, '2026-08-01')).toBe(false);
	});

	it('excludes entries that have ended', () => {
		expect(isActiveOn({ entryDate: '2020-01-01', endDate: '2025-12-31' }, '2026-08-01')).toBe(
			false
		);
	});

	it('includes an open-ended entry that has started', () => {
		expect(isActiveOn({ entryDate: '2020-01-01', endDate: null }, '2026-08-01')).toBe(true);
	});
});

describe('computeCashflow', () => {
	const asOf = '2026-08-01';

	it('computes income, expenses, net and savings rate', () => {
		const result = computeCashflow(
			[
				cashflow({ id: 'i1', entryType: 'income', amount: '100000' }),
				cashflow({ id: 'e1', entryType: 'expense', category: 'living', amount: '70000' })
			],
			'THB',
			RATES,
			asOf
		);
		expect(result.monthlyIncome.toString()).toBe('100000');
		expect(result.monthlyExpenses.toString()).toBe('70000');
		expect(result.netCashflow.toString()).toBe('30000');
		expect(result.savingsRate?.toString()).toBe('30');
	});

	it('returns a null savings rate with no income, rather than zero', () => {
		const result = computeCashflow(
			[cashflow({ id: 'e1', entryType: 'expense', category: 'living', amount: '5000' })],
			'THB',
			RATES,
			asOf
		);
		expect(result.savingsRate).toBeNull();
	});

	it('produces a negative savings rate when outgoings exceed income', () => {
		const result = computeCashflow(
			[
				cashflow({ id: 'i1', entryType: 'income', amount: '50000' }),
				cashflow({ id: 'e1', entryType: 'expense', category: 'living', amount: '65000' })
			],
			'THB',
			RATES,
			asOf
		);
		expect(result.netCashflow.toString()).toBe('-15000');
		expect(result.savingsRate?.toString()).toBe('-30');
	});

	it('keeps one-off entries out of the monthly run rate', () => {
		const result = computeCashflow(
			[
				cashflow({ id: 'i1', entryType: 'income', amount: '100000' }),
				cashflow({
					id: 'e1',
					entryType: 'expense',
					category: 'other_expense',
					amount: '68000',
					frequency: 'once',
					isRecurring: false,
					entryDate: '2026-06-01'
				})
			],
			'THB',
			RATES,
			asOf
		);
		expect(result.monthlyExpenses.toString()).toBe('0');
		expect(result.oneOffExpenses.toString()).toBe('68000');
	});

	it('converts foreign-currency entries', () => {
		const result = computeCashflow(
			[cashflow({ id: 'i1', entryType: 'income', amount: '1000', currency: 'USD' })],
			'THB',
			RATES,
			asOf
		);
		expect(result.monthlyIncome.toString()).toBe('36500');
	});

	it('excludes rows with no rate and reports the pair', () => {
		const result = computeCashflow(
			[cashflow({ id: 'i1', entryType: 'income', amount: '1000', currency: 'JPY' })],
			'THB',
			RATES,
			asOf
		);
		expect(result.monthlyIncome.toString()).toBe('0');
		expect(result.missingRates).toEqual(['JPY/THB']);
	});

	it('breaks down by category, largest first', () => {
		const result = computeCashflow(
			[
				cashflow({ id: 'e1', entryType: 'expense', category: 'living', amount: '30000' }),
				cashflow({ id: 'e2', entryType: 'expense', category: 'housing', amount: '40000' })
			],
			'THB',
			RATES,
			asOf
		);
		expect(result.expensesByCategory[0].category).toBe('housing');
		expect(result.expensesByCategory[0].share?.toString()).toBe(
			new Decimal(40000).dividedBy(70000).times(100).toString()
		);
	});

	it('is empty for an account with no entries', () => {
		const result = computeCashflow([], 'THB', RATES, asOf);
		expect(result.monthlyIncome.toString()).toBe('0');
		expect(result.incomeByCategory).toEqual([]);
	});
});

describe('emergencyCover', () => {
	it('is months of expenses covered', () => {
		expect(emergencyCover(new Decimal(600000), new Decimal(100000))?.toString()).toBe('6');
	});

	it('is null when there are no expenses to cover', () => {
		expect(emergencyCover(new Decimal(600000), new Decimal(0))).toBeNull();
	});
});

describe('trailingMonthlyFlow', () => {
	it('returns twelve points ending at the anchor month', () => {
		const points = trailingMonthlyFlow([cashflow()], 'THB', RATES, '2026-08-15');
		expect(points).toHaveLength(12);
		expect(points[11].month).toBe('2026-08');
		expect(points[0].month).toBe('2025-09');
	});

	it('carries the recurring run rate into every month', () => {
		const points = trailingMonthlyFlow(
			[cashflow({ amount: '100000', entryDate: '2020-01-01' })],
			'THB',
			RATES,
			'2026-08-15'
		);
		expect(points.every((p) => p.income.toString() === '100000')).toBe(true);
	});

	it('places a one-off only in its own month', () => {
		const points = trailingMonthlyFlow(
			[
				cashflow({
					id: 'e1',
					entryType: 'expense',
					category: 'other_expense',
					amount: '68000',
					frequency: 'once',
					isRecurring: false,
					entryDate: '2026-06-10'
				})
			],
			'THB',
			RATES,
			'2026-08-15'
		);
		const june = points.find((p) => p.month === '2026-06');
		const july = points.find((p) => p.month === '2026-07');
		expect(june?.expenses.toString()).toBe('68000');
		expect(july?.expenses.toString()).toBe('0');
	});
});
