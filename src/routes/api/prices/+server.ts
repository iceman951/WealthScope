import { json } from '@sveltejs/kit';
import { requireUserOrFail } from '$lib/server/authorization';
import { listInvestments, listPriceHistory } from '$lib/server/repositories/assets';
import type { RequestHandler } from './$types';

/**
 * Price history as JSON.
 *
 * An async client request that does not map onto a form action — the risk screen
 * and any future mobile client read the same shape. Scoped to the caller's own
 * holdings by the repository, which joins through `assets.user_id`.
 */
export const GET: RequestHandler = async (event) => {
	const user = requireUserOrFail(event);

	const requested = event.url.searchParams.getAll('assetId');
	const holdings = await listInvestments(user.id);
	const owned = new Set(holdings.map((h) => h.id));

	// Ids from the query string are filtered against what this user owns; an id
	// belonging to someone else simply does not appear in the result.
	const assetIds = requested.length > 0 ? requested.filter((id) => owned.has(id)) : [...owned];

	const rows = await listPriceHistory(user.id, assetIds);

	return json(
		{
			assets: holdings
				.filter((h) => assetIds.includes(h.id))
				.map((h) => ({ id: h.id, name: h.name, symbol: h.symbol, currency: h.currency })),
			prices: rows.map((r) => ({
				assetId: r.assetId,
				date: r.priceDate,
				price: r.price,
				currency: r.currency
			}))
		},
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
