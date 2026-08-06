import { json } from '@sveltejs/kit';
import { ASSET_TYPE_LABELS, type AssetType } from '$lib/types/domain';
import { requireUserOrFail } from '$lib/server/authorization';
import { loadAnalysis } from '$lib/server/services/portfolio';
import type { RequestHandler } from './$types';

/**
 * Read-only asset listing with computed values, for async client requests and as
 * the shape a future mobile client would consume. Writes go through the form
 * actions on /assets — there is no duplicate REST mutation surface.
 */
export const GET: RequestHandler = async (event) => {
	const user = requireUserOrFail(event);
	const analysis = await loadAnalysis(user.id);

	return json(
		{
			baseCurrency: analysis.settings.baseCurrency,
			asOf: analysis.asOf,
			totalAssets: analysis.metrics.netWorth.totalAssets.toString(),
			missingRates: analysis.metrics.missingRates,
			assets: analysis.metrics.netWorth.assets.map((entry) => ({
				id: entry.asset.id,
				name: entry.asset.name,
				assetType: entry.asset.assetType,
				assetTypeLabel: ASSET_TYPE_LABELS[entry.asset.assetType as AssetType],
				symbol: entry.asset.symbol,
				currency: entry.asset.currency,
				nativeValue: entry.nativeValue.toString(),
				baseValue: entry.baseValue.toString(),
				liquidity: entry.liquidity,
				accountName: entry.asset.accountName,
				valuationDate: entry.asset.valuationDate
			}))
		},
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
