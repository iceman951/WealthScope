import { toStorage } from '$engine/money';
import { upsertSnapshot } from '../repositories/snapshots';
import { loadAnalysis, today } from './portfolio';

/**
 * Portfolio snapshots.
 *
 * Written from the server-side analysis only. A snapshot records the exchange
 * rates it used so the history stays reproducible even after rates move.
 */

export async function captureSnapshot(userId: string, asOf = today()) {
	const { metrics } = await loadAnalysis(userId, { asOf });

	return upsertSnapshot(userId, {
		snapshotDate: asOf,
		baseCurrency: metrics.baseCurrency,
		totalAssets: toStorage(metrics.netWorth.totalAssets),
		totalLiabilities: toStorage(metrics.netWorth.totalLiabilities),
		netWorth: toStorage(metrics.netWorth.netWorth),
		liquidAssets: toStorage(metrics.netWorth.liquidAssets),
		investmentAssets: toStorage(metrics.netWorth.investmentAssets),
		metadataJson: {
			appliedRates: metrics.netWorth.appliedRates,
			missingRates: metrics.missingRates,
			allocation: metrics.allocationByClass.map((slice) => ({
				key: slice.key,
				value: toStorage(slice.value),
				share: slice.share ? slice.share.toFixed(4) : null
			})),
			healthScore: metrics.health.composite
		}
	});
}
