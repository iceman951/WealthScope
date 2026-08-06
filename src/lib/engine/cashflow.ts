import {
	CASHFLOW_CATEGORY_LABELS,
	FREQUENCY_PER_YEAR,
	type CashflowCategory,
	type CashflowEntryType
} from '$lib/types/domain';
import { convert, type RateTable } from './currency';
import { Decimal, ZERO, dec, divide } from './money';
import type { CashflowInput } from './types';

/**
 * Cash flow.
 *
 * A recurring entry contributes `amount × occurrencesPerYear ÷ 12` to the monthly
 * figure. One-off entries contribute nothing to the recurring monthly run rate —
 * they are reported separately, because treating a single purchase as a monthly
 * commitment would understate the savings rate for a year.
 */

/** Monthly equivalent of one entry, in its own currency. */
export function monthlyAmount(
	entry: Pick<CashflowInput, 'amount' | 'frequency' | 'isRecurring'>
): Decimal {
	if (!entry.isRecurring) return ZERO;
	const perYear = FREQUENCY_PER_YEAR[entry.frequency] ?? 0;
	if (perYear === 0) return ZERO;
	return dec(entry.amount).times(perYear).dividedBy(12);
}

/** True when the entry is in force on `asOf`. */
export function isActiveOn(
	entry: Pick<CashflowInput, 'entryDate' | 'endDate'>,
	asOf: string
): boolean {
	if (entry.entryDate > asOf) return false;
	if (entry.endDate && entry.endDate < asOf) return false;
	return true;
}

export interface CategoryBreakdown {
	category: CashflowCategory;
	label: string;
	monthly: Decimal;
	share: Decimal | null;
	entries: { id: string; name: string; monthly: Decimal; note: string }[];
}

export interface CashflowResult {
	monthlyIncome: Decimal;
	monthlyExpenses: Decimal;
	netCashflow: Decimal;
	/** (income − expenses) ÷ income, as a percentage. Null when income is zero. */
	savingsRate: Decimal | null;
	recurringIncome: Decimal;
	recurringExpenses: Decimal;
	/** One-off entries active in the current period, annualised to a monthly figure. */
	oneOffIncome: Decimal;
	oneOffExpenses: Decimal;
	incomeByCategory: CategoryBreakdown[];
	expensesByCategory: CategoryBreakdown[];
	missingRates: string[];
}

export function computeCashflow(
	entries: readonly CashflowInput[],
	baseCurrency: string,
	rates: RateTable,
	asOf: string
): CashflowResult {
	const missing = new Set<string>();
	const byCategory = new Map<CashflowCategory, CategoryBreakdown>();

	let monthlyIncome = ZERO;
	let monthlyExpenses = ZERO;
	let recurringIncome = ZERO;
	let recurringExpenses = ZERO;
	let oneOffIncome = ZERO;
	let oneOffExpenses = ZERO;

	for (const entry of entries) {
		if (!isActiveOn(entry, asOf)) continue;

		const native = monthlyAmount(entry);
		const converted = convert(native, entry.currency, baseCurrency, rates);
		if (!converted.ok) {
			missing.add(converted.missing);
			continue;
		}
		const monthly = converted.value;

		if (entry.isRecurring) {
			if (entry.entryType === 'income') recurringIncome = recurringIncome.plus(monthly);
			else recurringExpenses = recurringExpenses.plus(monthly);
		} else {
			// One-off rows carry their full amount, not a monthly slice.
			const raw = convert(entry.amount, entry.currency, baseCurrency, rates);
			if (raw.ok) {
				if (entry.entryType === 'income') oneOffIncome = oneOffIncome.plus(raw.value);
				else oneOffExpenses = oneOffExpenses.plus(raw.value);
			}
			continue;
		}

		if (entry.entryType === 'income') monthlyIncome = monthlyIncome.plus(monthly);
		else monthlyExpenses = monthlyExpenses.plus(monthly);

		const bucket = byCategory.get(entry.category) ?? {
			category: entry.category,
			label: CASHFLOW_CATEGORY_LABELS[entry.category] ?? entry.category,
			monthly: ZERO,
			share: null,
			entries: []
		};
		bucket.monthly = bucket.monthly.plus(monthly);
		bucket.entries.push({
			id: entry.id,
			name: entry.name,
			monthly,
			note: entry.notes ?? ''
		});
		byCategory.set(entry.category, bucket);
	}

	const split = (type: CashflowEntryType) => {
		const total = type === 'income' ? monthlyIncome : monthlyExpenses;
		return [...byCategory.values()]
			.filter((b) => isIncomeCategory(b.category) === (type === 'income'))
			.map((b) => ({
				...b,
				share: total.isZero() ? null : b.monthly.dividedBy(total).times(100),
				entries: [...b.entries].sort((x, y) => y.monthly.comparedTo(x.monthly))
			}))
			.sort((a, b) => b.monthly.comparedTo(a.monthly));
	};

	const savingsRate = divide(monthlyIncome.minus(monthlyExpenses), monthlyIncome);

	return {
		monthlyIncome,
		monthlyExpenses,
		netCashflow: monthlyIncome.minus(monthlyExpenses),
		savingsRate: savingsRate === null ? null : savingsRate.times(100),
		recurringIncome,
		recurringExpenses,
		oneOffIncome,
		oneOffExpenses,
		incomeByCategory: split('income'),
		expensesByCategory: split('expense'),
		missingRates: [...missing].sort()
	};
}

const INCOME_SET = new Set<string>([
	'salary',
	'business',
	'rental',
	'dividends',
	'interest',
	'pension',
	'other_income'
]);

export function isIncomeCategory(category: CashflowCategory): boolean {
	return INCOME_SET.has(category);
}

/** Months of expenses covered by liquid assets. Null when there are no expenses. */
export function emergencyCover(liquidAssets: Decimal, monthlyExpenses: Decimal): Decimal | null {
	return divide(liquidAssets, monthlyExpenses);
}

/**
 * Twelve trailing months of income and expense, from dated entries. Months with no
 * recorded entry inherit the recurring run rate, which is what the design's
 * twelve-month bar chart shows.
 */
export interface MonthlyFlowPoint {
	/** YYYY-MM */
	month: string;
	label: string;
	income: Decimal;
	expenses: Decimal;
}

export function trailingMonthlyFlow(
	entries: readonly CashflowInput[],
	baseCurrency: string,
	rates: RateTable,
	asOf: string,
	months = 12
): MonthlyFlowPoint[] {
	const anchor = new Date(`${asOf}T00:00:00Z`);
	const points: MonthlyFlowPoint[] = [];

	for (let i = months - 1; i >= 0; i--) {
		const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i, 1));
		const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
		const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
			.toISOString()
			.slice(0, 10);

		let income = ZERO;
		let expenses = ZERO;
		for (const entry of entries) {
			if (!isActiveOn(entry, monthEnd)) continue;
			const native = entry.isRecurring
				? monthlyAmount(entry)
				: matchesMonth(entry, month)
					? dec(entry.amount)
					: ZERO;
			if (native.isZero()) continue;
			const converted = convert(native, entry.currency, baseCurrency, rates);
			if (!converted.ok) continue;
			if (entry.entryType === 'income') income = income.plus(converted.value);
			else expenses = expenses.plus(converted.value);
		}

		points.push({
			month,
			label: MONTH_INITIALS[d.getUTCMonth()],
			income,
			expenses
		});
	}

	return points;
}

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function matchesMonth(entry: CashflowInput, month: string): boolean {
	return entry.entryDate.slice(0, 7) === month;
}
