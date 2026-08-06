import { fail } from '@sveltejs/kit';
import { sumBy } from '$engine/money';
import { assetInputSchema, deleteSchema } from '$lib/schemas/financial';
import { requireUser, requireUserOrFail } from '$lib/server/authorization';
import { listAccounts } from '$lib/server/repositories/accounts';
import { listAssetTypesInUse } from '$lib/server/repositories/assets';
import { loadAnalysis } from '$lib/server/services/portfolio';
import * as records from '$lib/server/services/records';
import { attempt, ok, parseForm } from '$lib/server/services/result';
import { ASSET_TYPES, type AssetType } from '$lib/types/domain';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);

	const requested = event.url.searchParams.get('type');
	const filter: AssetType | null =
		requested && (ASSET_TYPES as readonly string[]).includes(requested)
			? (requested as AssetType)
			: null;

	const [analysis, typesInUse, accounts] = await Promise.all([
		loadAnalysis(user.id),
		listAssetTypesInUse(user.id),
		listAccounts(user.id)
	]);

	const { metrics, settings } = analysis;

	const rows = metrics.netWorth.assets
		.filter((a) => !filter || a.asset.assetType === filter)
		.map((a) => ({
			id: a.asset.id,
			name: a.asset.name,
			assetType: a.asset.assetType,
			symbol: a.asset.symbol,
			currency: a.asset.currency,
			quantity: a.asset.quantity,
			unitPrice: a.asset.unitPrice,
			manualValue: a.asset.manualValue,
			acquisitionCost: a.asset.acquisitionCost,
			valuationDate: a.asset.valuationDate,
			accountId: a.asset.accountId,
			accountName: a.asset.accountName,
			liquidity: a.liquidity,
			nativeValue: a.nativeValue,
			baseValue: a.baseValue,
			share: metrics.netWorth.totalAssets.isZero()
				? null
				: a.baseValue.dividedBy(metrics.netWorth.totalAssets).times(100)
		}));

	return {
		rows,
		shownTotal: sumBy(rows, (r) => r.baseValue),
		filter,
		typesInUse,
		accounts: accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency })),
		baseCurrency: settings.baseCurrency,
		totalAssets: metrics.netWorth.totalAssets,
		missingRates: metrics.missingRates,
		today: analysis.asOf
	};
};

export const actions: Actions = {
	create: async (event) => {
		const user = requireUserOrFail(event);
		const parsed = parseForm(assetInputSchema, await event.request.formData());
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'asset.create', route: '/assets', user: user.id, values: parsed.values },
			() => records.createAsset(user.id, parsed.value)
		);
		if (!result.ok) return fail(500, result.failure);

		return ok('Asset saved. Every metric has been recomputed.');
	},

	update: async (event) => {
		const user = requireUserOrFail(event);
		const data = await event.request.formData();
		const id = String(data.get('id') ?? '');
		const parsed = parseForm(assetInputSchema, data);
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'asset.update', route: '/assets', user: user.id, values: parsed.values },
			() => records.updateAsset(user.id, id, parsed.value)
		);
		if (!result.ok) return fail(500, result.failure);

		return ok('Asset updated.');
	},

	delete: async (event) => {
		const user = requireUserOrFail(event);
		const parsed = parseForm(deleteSchema, await event.request.formData());
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt({ event: 'asset.delete', route: '/assets', user: user.id }, () =>
			records.deleteAsset(user.id, parsed.value.id)
		);
		if (!result.ok) return fail(500, result.failure);

		return ok('Asset removed.');
	}
};
