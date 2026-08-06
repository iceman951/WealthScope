import { requireUser } from '$lib/server/authorization';
import { ALLOCATION_COLORS } from '$engine/allocation';
import { trailingMonthlyFlow } from '$engine/cashflow';
import { dec } from '$engine/money';
import { listCashflowEntries, toEngineCashflow } from '$lib/server/repositories/cashflow';
import { ratesAsOf } from '$lib/server/repositories/rates';
import { listTransactions } from '$lib/server/repositories/transactions';
import { loadAnalysis } from '$lib/server/services/portfolio';
import type { AssetType } from '$lib/types/domain';
import type { PageServerLoad } from './$types';

/**
 * The dashboard reads from one analysis pass plus two small extra queries, rather
 * than one query per card.
 */
export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const analysis = await loadAnalysis(user.id);
	const { metrics } = analysis;

	const [entries, recentTransactions, rates] = await Promise.all([
		listCashflowEntries(user.id),
		listTransactions(user.id, { limit: 8 }),
		ratesAsOf(analysis.asOf)
	]);

	const flow = trailingMonthlyFlow(
		entries.map(toEngineCashflow),
		metrics.baseCurrency,
		rates,
		analysis.asOf
	);

	// Chart coordinates only — never a figure the user reads as money.
	const trend = analysis.snapshots.map((s) => dec(s.netWorth).toNumber());
	const trendLabels = axisLabels(analysis.snapshots.map((s) => s.snapshotDate));

	return {
		metrics,
		netWorthDelta: analysis.netWorthDelta,
		asOf: analysis.asOf,
		trend,
		trendLabels,
		snapshotCount: analysis.snapshots.length,
		allocationColors: Object.fromEntries(
			metrics.allocationByClass.map((slice) => [
				slice.key,
				ALLOCATION_COLORS[slice.key as AssetType] ?? 'var(--color-neutral-300)'
			])
		),
		flow: flow.map((point) => ({
			month: point.month,
			label: point.label,
			income: point.income,
			expenses: point.expenses
		})),
		recentTransactions: recentTransactions.map((tx) => ({
			id: tx.id,
			date: tx.transactionDate,
			type: tx.transactionType,
			assetName: tx.assetName,
			assetSymbol: tx.assetSymbol,
			accountName: tx.accountName,
			amount: tx.grossAmount,
			currency: tx.currency
		}))
	};
};

/** Five evenly spaced date labels across the snapshot window. */
function axisLabels(dates: readonly string[]): string[] {
	if (dates.length === 0) return [];
	const picks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (dates.length - 1)));
	return [...new Set(picks)].map((index) => {
		const [year, month] = dates[index].split('-');
		return `${MONTHS[Number(month) - 1]} ${year}`;
	});
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
