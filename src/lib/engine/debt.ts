import { liabilityClassOf, LIABILITY_TYPE_LABELS } from '$lib/types/domain';
import { Decimal, ONE, ZERO, dec, divide } from './money';
import type { ConvertedLiability } from './net-worth';

/**
 * Debt metrics and payoff projections.
 *
 * Rates are stored as annual percentages (3.4 = 3.4% p.a.). Monthly interest uses
 * a simple nominal rate ÷ 12, which is how consumer loan statements in the region
 * are quoted; the payoff schedule below applies it on the reducing balance.
 */

export interface DebtPosition {
	id: string;
	name: string;
	type: string;
	typeLabel: string;
	/** Secured / Unsecured / Revolving. */
	group: 'Secured' | 'Unsecured' | 'Revolving';
	balance: Decimal;
	annualRate: Decimal;
	monthlyPayment: Decimal;
	/** Interest accruing over the next twelve months at the current balance. */
	annualInterest: Decimal;
	maturityDate: string | null;
}

export interface DebtMetrics {
	totalDebt: Decimal;
	/** Balance-weighted average annual rate. Null when there is no debt. */
	weightedAverageRate: Decimal | null;
	monthlyDebtPayment: Decimal;
	/** Total debt ÷ total assets, as a percentage. Null when assets are zero. */
	debtToAssets: Decimal | null;
	/** Debt payments ÷ gross monthly income, as a percentage. Null without income. */
	debtServiceRatio: Decimal | null;
	annualInterest: Decimal;
	positions: DebtPosition[];
	/** Highest rate first — the avalanche order the design shows. */
	payoffOrder: DebtPosition[];
}

export function computeDebtMetrics(
	liabilities: readonly ConvertedLiability[],
	totalAssets: Decimal,
	monthlyIncome: Decimal
): DebtMetrics {
	const positions: DebtPosition[] = liabilities.map(
		({ liability, baseBalance, baseMonthlyPayment }) => {
			const annualRate = dec(liability.interestRate);
			return {
				id: liability.id,
				name: liability.name,
				type: liability.liabilityType,
				typeLabel: LIABILITY_TYPE_LABELS[liability.liabilityType] ?? liability.liabilityType,
				group: liabilityClassOf(liability.liabilityType),
				balance: baseBalance,
				annualRate,
				monthlyPayment: baseMonthlyPayment,
				annualInterest: baseBalance.times(annualRate).dividedBy(100),
				maturityDate: liability.maturityDate
			};
		}
	);

	const totalDebt = positions.reduce<Decimal>((acc, p) => acc.plus(p.balance), ZERO);
	const monthlyDebtPayment = positions.reduce<Decimal>(
		(acc, p) => acc.plus(p.monthlyPayment),
		ZERO
	);
	const annualInterest = positions.reduce<Decimal>((acc, p) => acc.plus(p.annualInterest), ZERO);

	const weighted = positions.reduce<Decimal>(
		(acc, p) => acc.plus(p.balance.times(p.annualRate)),
		ZERO
	);

	const debtToAssets = divide(totalDebt, totalAssets);
	const debtServiceRatio = divide(monthlyDebtPayment, monthlyIncome);

	return {
		totalDebt,
		weightedAverageRate: divide(weighted, totalDebt),
		monthlyDebtPayment,
		debtToAssets: debtToAssets === null ? null : debtToAssets.times(100),
		debtServiceRatio: debtServiceRatio === null ? null : debtServiceRatio.times(100),
		annualInterest,
		positions,
		payoffOrder: [...positions].sort((a, b) => b.annualRate.comparedTo(a.annualRate))
	};
}

export interface AmortisationPoint {
	monthIndex: number;
	interest: Decimal;
	principal: Decimal;
	balance: Decimal;
}

export interface PayoffProjection {
	/** Null when the payment never clears the interest, or when there is no payment. */
	monthsToPayoff: number | null;
	totalInterest: Decimal;
	schedule: AmortisationPoint[];
	/** True when the monthly payment does not even cover one month of interest. */
	neverAmortises: boolean;
}

const MAX_SCHEDULE_MONTHS = 720; // 60 years; beyond this the answer is "never".

/**
 * Reducing-balance amortisation. Pure and deterministic: same inputs, same
 * schedule, which is what the projection snapshot tests assert.
 */
export function amortise(
	balance: Decimal,
	annualRatePercent: Decimal,
	monthlyPayment: Decimal,
	maxMonths = MAX_SCHEDULE_MONTHS
): PayoffProjection {
	const schedule: AmortisationPoint[] = [];
	let remaining = balance;
	let totalInterest = ZERO;
	const monthlyRate = annualRatePercent.dividedBy(100).dividedBy(12);

	if (remaining.lessThanOrEqualTo(0)) {
		return { monthsToPayoff: 0, totalInterest: ZERO, schedule, neverAmortises: false };
	}
	if (monthlyPayment.lessThanOrEqualTo(0)) {
		return { monthsToPayoff: null, totalInterest: ZERO, schedule, neverAmortises: true };
	}

	const firstInterest = remaining.times(monthlyRate);
	if (monthlyPayment.lessThanOrEqualTo(firstInterest)) {
		return { monthsToPayoff: null, totalInterest: ZERO, schedule, neverAmortises: true };
	}

	for (let month = 1; month <= maxMonths; month++) {
		const interest = remaining.times(monthlyRate);
		const payment = Decimal.min(monthlyPayment, remaining.plus(interest));
		const principal = payment.minus(interest);
		remaining = remaining.minus(principal);
		totalInterest = totalInterest.plus(interest);
		schedule.push({
			monthIndex: month,
			interest,
			principal,
			balance: Decimal.max(remaining, ZERO)
		});
		if (remaining.lessThanOrEqualTo(new Decimal('0.005'))) {
			return { monthsToPayoff: month, totalInterest, schedule, neverAmortises: false };
		}
	}

	return { monthsToPayoff: null, totalInterest, schedule, neverAmortises: false };
}

/** Months remaining, formatted the way the Liabilities table shows a term. */
export function formatTerm(months: number | null, neverAmortises: boolean): string {
	if (neverAmortises) return 'Revolving';
	if (months === null) return '—';
	if (months < 12) return `${months} mo`;
	const years = Math.round((months / 12) * 10) / 10;
	return `${years % 1 === 0 ? years.toFixed(0) : years.toFixed(1)} yr`;
}

/**
 * Avalanche payoff: minimum payments everywhere, every spare baht to the highest
 * rate. Returns the order and the month each debt clears.
 */
export interface AvalancheStep {
	id: string;
	name: string;
	rank: number;
	annualRate: Decimal;
	balance: Decimal;
	annualInterest: Decimal;
	clearedInMonth: number | null;
}

export function avalanchePlan(
	positions: readonly DebtPosition[],
	extraMonthlyPayment: Decimal = ZERO
): AvalancheStep[] {
	const ordered = [...positions].sort((a, b) => b.annualRate.comparedTo(a.annualRate));
	let spare = extraMonthlyPayment;

	return ordered.map((p, index) => {
		const payment = p.monthlyPayment.plus(index === 0 ? spare : ZERO);
		const result = amortise(p.balance, p.annualRate, payment);
		// Once a debt clears, its payment rolls into the next one.
		if (result.monthsToPayoff !== null) spare = spare.plus(p.monthlyPayment);
		return {
			id: p.id,
			name: p.name,
			rank: index + 1,
			annualRate: p.annualRate,
			balance: p.balance,
			annualInterest: p.annualInterest,
			clearedInMonth: result.monthsToPayoff
		};
	});
}

/** Bar width for the payoff list: the rate against a 20% reference ceiling. */
export function rateBarFraction(annualRate: Decimal): Decimal {
	return Decimal.min(annualRate.dividedBy(20), ONE).times(100);
}
