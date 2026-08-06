import {
	analyse,
	DEFAULT_SLEEVE_TARGETS,
	netWorthDelta,
	type AnalysisMetrics
} from '$engine/analysis';
import type { UserSettings } from '$lib/types/session';
import { Decimal } from '$engine/money';
import { listAssets, listPriceHistory, toEngineAsset } from '../repositories/assets';
import { listCashflowEntries, toEngineCashflow } from '../repositories/cashflow';
import { listLiabilities, toEngineLiability } from '../repositories/liabilities';
import { ratesAsOf } from '../repositories/rates';
import { getSettings } from '../repositories/settings';
import { listSnapshots, toEngineSnapshot } from '../repositories/snapshots';
import { listTransactions, toEngineTransaction } from '../repositories/transactions';
import type { PricePoint } from '$engine/types';

/**
 * The canonical portfolio calculation.
 *
 * Every total the application shows or persists comes from here, on the server.
 * The browser may compute a preview (the projection sliders do), but nothing
 * client-calculated is ever written back or treated as authoritative.
 */

export interface PortfolioAnalysis {
	metrics: AnalysisMetrics;
	settings: UserSettings;
	/** Change in net worth across the recorded snapshots, for the dashboard delta. */
	netWorthDelta: Decimal | null;
	snapshots: { snapshotDate: string; netWorth: string }[];
	asOf: string;
}

export function today(): string {
	return new Date().toISOString().slice(0, 10);
}

/**
 * Loads everything the analysis needs in a small number of intentional queries —
 * five parallel reads, not one per dashboard card.
 */
export async function loadAnalysis(
	userId: string,
	options: { asOf?: string } = {}
): Promise<PortfolioAnalysis> {
	const asOf = options.asOf ?? today();

	const [settings, assetRows, liabilityRows, cashflowRows, snapshotRows] = await Promise.all([
		getSettings(userId),
		listAssets(userId),
		listLiabilities(userId),
		listCashflowEntries(userId),
		listSnapshots(userId)
	]);

	const rates = await ratesAsOf(asOf);

	const metrics = analyse({
		assets: assetRows.map(toEngineAsset),
		liabilities: liabilityRows.map(toEngineLiability),
		cashflow: cashflowRows.map(toEngineCashflow),
		snapshots: snapshotRows.map(toEngineSnapshot),
		rates,
		settings: {
			baseCurrency: settings.baseCurrency,
			emergencyFundMonths: settings.emergencyFundMonths,
			sleeveTargets: DEFAULT_SLEEVE_TARGETS
		},
		asOf
	});

	return {
		metrics,
		settings,
		netWorthDelta: netWorthDelta(snapshotRows.map(toEngineSnapshot)),
		snapshots: snapshotRows.map((s) => ({ snapshotDate: s.snapshotDate, netWorth: s.netWorth })),
		asOf
	};
}

/** Price history grouped per holding, for the risk screen. */
export async function loadPriceSeries(
	userId: string,
	assetIds: readonly string[]
): Promise<Map<string, PricePoint[]>> {
	const rows = await listPriceHistory(userId, assetIds);
	const series = new Map<string, PricePoint[]>();
	for (const row of rows) {
		const list = series.get(row.assetId) ?? [];
		list.push({ priceDate: row.priceDate, price: row.price, currency: row.currency });
		series.set(row.assetId, list);
	}
	return series;
}

/** Trade history for the return calculations. */
export async function loadTransactionHistory(userId: string) {
	const rows = await listTransactions(userId);
	return rows.map(toEngineTransaction);
}
