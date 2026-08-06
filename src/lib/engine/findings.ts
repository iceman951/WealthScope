import type { FindingSeverity } from '$lib/types/domain';
import { REBALANCE_THRESHOLD_PP } from './returns';
import { Decimal } from './money';
import type { AnalysisMetrics } from './analysis';

/**
 * Findings are rule objects: each declares an id, a severity, a predicate over the
 * computed metrics and a copy template. Adding a rule needs no UI change.
 */

export interface Finding {
	id: string;
	severity: FindingSeverity;
	title: string;
	body: string;
}

export interface FindingRule {
	id: string;
	severity: FindingSeverity;
	/** Returns the copy when the rule fires, or null when it does not apply. */
	evaluate: (m: AnalysisMetrics, fmt: FindingFormatters) => { title: string; body: string } | null;
}

export interface FindingFormatters {
	money: (value: Decimal) => string;
	percent: (value: Decimal, decimals?: number) => string;
	number: (value: Decimal, decimals?: number) => string;
}

const TOP_HOLDING_GUIDANCE = new Decimal(25);
const EXPENSIVE_DEBT_RATE = new Decimal(12);
const HIGH_BALANCE_SHEET_CONCENTRATION = new Decimal(50);

export const FINDING_RULES: readonly FindingRule[] = [
	{
		id: 'expensive-debt',
		severity: 'Act now',
		evaluate: (m, f) => {
			const worst = m.debt.payoffOrder[0];
			if (!worst || worst.annualRate.lessThan(EXPENSIVE_DEBT_RATE)) return null;
			if (worst.balance.lessThanOrEqualTo(0)) return null;
			return {
				title: `${worst.name} at ${f.percent(worst.annualRate)} is the most expensive money you hold`,
				body: `Balance ${f.money(worst.balance)}. Clearing it from liquid savings saves about ${f.money(worst.annualInterest)} a year and lifts the debt-load score.`
			};
		}
	},
	{
		id: 'liquidity-thin',
		severity: 'Act now',
		evaluate: (m, f) => {
			if (m.liquidityCover === null) return null;
			if (m.liquidityCover.greaterThanOrEqualTo(3)) return null;
			return {
				title: `Liquidity cover of ${f.number(m.liquidityCover, 1)} months is below three`,
				body: `Liquid assets of ${f.money(m.netWorth.liquidAssets)} against ${f.money(m.cashflow.monthlyExpenses)} of monthly outgoings. A shock would have to be met from illiquid holdings or new debt.`
			};
		}
	},
	{
		id: 'negative-cashflow',
		severity: 'Act now',
		evaluate: (m, f) => {
			if (m.cashflow.netCashflow.greaterThanOrEqualTo(0)) return null;
			return {
				title: 'Monthly outgoings exceed income',
				body: `Net flow is ${f.money(m.cashflow.netCashflow)} a month. The gap is being met from savings or credit; nothing else on this page improves until it closes.`
			};
		}
	},
	{
		id: 'single-name-exposure',
		severity: 'Review',
		evaluate: (m, f) => {
			const top = m.portfolioConcentration.top1Share;
			if (top === null || top.lessThanOrEqualTo(TOP_HOLDING_GUIDANCE)) return null;
			const name = m.portfolioConcentration.positions[0]?.label ?? 'the largest holding';
			return {
				title: `Single-name exposure of ${f.percent(top)} inside the portfolio`,
				body: `${name} is above the ${f.percent(TOP_HOLDING_GUIDANCE, 0)} guidance. A position this size drives portfolio risk more than the allocation on paper suggests.`
			};
		}
	},
	{
		id: 'balance-sheet-concentration',
		severity: 'Review',
		evaluate: (m, f) => {
			const largest = m.balanceSheetConcentration.positions[0];
			if (!largest || largest.share.lessThanOrEqualTo(HIGH_BALANCE_SHEET_CONCENTRATION))
				return null;
			return {
				title: `${largest.label} is ${f.percent(largest.share)} of total assets`,
				body: 'Balance-sheet concentration outweighs portfolio concentration. Future contributions are the cheapest way to dilute it.'
			};
		}
	},
	{
		id: 'sleeve-drift',
		severity: 'Review',
		evaluate: (m, f) => {
			const drifted = m.sleeves
				.filter((s) => s.drift !== null && s.drift.abs().greaterThan(REBALANCE_THRESHOLD_PP))
				.sort((a, b) => b.drift!.abs().comparedTo(a.drift!.abs()));
			const worst = drifted[0];
			if (!worst) return null;
			return {
				title: `${worst.sleeve} is ${f.percent(worst.drift!.abs())} off its target weight`,
				body: `Actual ${f.percent(worst.actual!)} against a ${f.percent(worst.target!, 0)} target. Drift beyond ${f.percent(REBALANCE_THRESHOLD_PP, 0)} raises a rebalance finding.`
			};
		}
	},
	{
		id: 'debt-service',
		severity: 'Review',
		evaluate: (m, f) => {
			const dsr = m.debt.debtServiceRatio;
			if (dsr === null || dsr.lessThanOrEqualTo(36)) return null;
			return {
				title: `Debt service is ${f.percent(dsr)} of gross monthly income`,
				body: `${f.money(m.debt.monthlyDebtPayment)} of ${f.money(m.cashflow.monthlyIncome)} goes to debt each month. Under 36% is the threshold used by the health score.`
			};
		}
	},
	{
		id: 'missing-rates',
		severity: 'Review',
		evaluate: (m) => {
			if (m.missingRates.length === 0) return null;
			return {
				title: 'Some holdings are missing an exchange rate',
				body: `No rate is recorded for ${m.missingRates.join(', ')}. Those rows are excluded from every total on this page until a rate is added in Settings.`
			};
		}
	},
	{
		id: 'healthy-liquidity',
		severity: 'Healthy',
		evaluate: (m, f) => {
			if (m.liquidityCover === null) return null;
			if (m.liquidityCover.lessThan(m.emergencyFundMonths)) return null;
			return {
				title: `Liquidity cover of ${f.number(m.liquidityCover, 1)} months`,
				body: `At or above the ${m.emergencyFundMonths}-month target set in Settings. ${f.money(m.netWorth.liquidAssets)} in liquid assets against ${f.money(m.cashflow.monthlyExpenses)} of monthly outgoings.`
			};
		}
	},
	{
		id: 'healthy-savings',
		severity: 'Healthy',
		evaluate: (m, f) => {
			const rate = m.cashflow.savingsRate;
			if (rate === null || rate.lessThan(15)) return null;
			return {
				title: `Savings rate of ${f.percent(rate)} is compounding`,
				body: `${f.money(m.cashflow.netCashflow)} a month is going into the balance sheet rather than out of it.`
			};
		}
	},
	{
		id: 'healthy-diversification',
		severity: 'Healthy',
		evaluate: (m, f) => {
			const hhi = m.portfolioConcentration.hhi;
			const effective = m.portfolioConcentration.effectiveHoldings;
			if (hhi === null || effective === null || hhi.greaterThan(new Decimal('0.15'))) return null;
			return {
				title: `Portfolio behaves like ${f.number(effective, 1)} equally sized holdings`,
				body: `Herfindahl index ${f.number(hhi, 2)} — below 0.15 is diversified.`
			};
		}
	}
];

export function evaluateFindings(
	metrics: AnalysisMetrics,
	formatters: FindingFormatters,
	rules: readonly FindingRule[] = FINDING_RULES
): Finding[] {
	const order: Record<FindingSeverity, number> = { 'Act now': 0, Review: 1, Healthy: 2 };
	const findings: Finding[] = [];

	for (const rule of rules) {
		const copy = rule.evaluate(metrics, formatters);
		if (copy) findings.push({ id: rule.id, severity: rule.severity, ...copy });
	}

	return findings.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function severityTagClass(severity: FindingSeverity): string {
	return severity === 'Healthy' ? 'tag-neutral' : 'tag-accent';
}
