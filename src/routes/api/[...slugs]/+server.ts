import { Elysia } from 'elysia';
import { error, isHttpError } from '@sveltejs/kit';
import { csvResponse } from '$lib/exporters/csv';
import { getAuth, resolveUser } from '$lib/server/auth';
import { listInvestments, listPriceHistory } from '$lib/server/repositories/assets';
import { buildCsv, exportFilename, type ExportKind } from '$lib/server/services/export';
import { loadAnalysis, today } from '$lib/server/services/portfolio';
import { log, reportUnexpected } from '$lib/server/security/logging';
import { consume } from '$lib/server/security/rate-limit';
import { ASSET_TYPE_LABELS, type AssetType } from '$lib/types/domain';

/**
 * The whole /api surface, served by one Elysia app mounted in SvelteKit.
 *
 * Page writes still go through form actions — there is no duplicate REST
 * mutation surface. Services throw SvelteKit's `error()`, which `onError` turns
 * back into the same status and JSON body the old endpoints returned.
 */

const KINDS: readonly ExportKind[] = [
	'assets',
	'liabilities',
	'cashflow',
	'transactions',
	'snapshots'
];

const NO_STORE = { 'cache-control': 'private, no-store' };

const app = new Elysia({ prefix: '/api' })
	.onError(({ code: kind, error: err, request }) => {
		if (isHttpError(err)) return Response.json(err.body, { status: err.status });
		if (kind === 'NOT_FOUND') return Response.json({ message: 'Not found.' }, { status: 404 });
		const { code, message } = reportUnexpected('api.unhandled', err, {
			route: new URL(request.url).pathname
		});
		return Response.json({ message, code }, { status: 500 });
	})

	// Better Auth's own endpoints. Registered before the session resolve below.
	.all('/auth/*', ({ request }) => getAuth().handler(request))

	// Everything after this needs a session. The user id only ever comes from here.
	.resolve(async ({ request }) => {
		const resolved = await resolveUser(request.headers);
		if (!resolved) error(401, 'You need to be signed in to do that.');
		return { user: resolved.user };
	})

	/** Asset listing with computed values, for async client requests. */
	.get('/assets', async ({ user }) => {
		const analysis = await loadAnalysis(user.id);
		return Response.json(
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
			{ headers: NO_STORE }
		);
	})

	/** Price history, scoped to the caller's own holdings. */
	.get('/prices', async ({ user, request }) => {
		const requested = new URL(request.url).searchParams.getAll('assetId');
		const holdings = await listInvestments(user.id);
		const owned = new Set(holdings.map((h) => h.id));

		// An id belonging to someone else simply does not appear in the result.
		const assetIds = requested.length > 0 ? requested.filter((id) => owned.has(id)) : [...owned];
		const rows = await listPriceHistory(user.id, assetIds);

		return Response.json(
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
			{ headers: NO_STORE }
		);
	})

	.get('/exports/csv', async ({ user, request }) => {
		const requested = new URL(request.url).searchParams.get('kind') ?? 'assets';
		if (!KINDS.includes(requested as ExportKind)) error(400, 'Unknown export type.');
		const kind = requested as ExportKind;

		const body = await buildCsv(user.id, kind);
		// Row counts are safe to log; the rows themselves never are.
		log('info', { event: 'export.csv', user: user.id, reason: kind });
		return csvResponse(exportFilename(kind, today()), body);
	})

	.get('/exports/pdf', async ({ user, request }) => {
		const limit = await consume('report', user.id);
		if (!limit.allowed) {
			error(429, `Too many reports. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.`);
		}

		const params = new URL(request.url).searchParams;
		const sections = {
			netWorth: params.get('netWorth') !== 'false',
			allocation: params.get('allocation') !== 'false',
			risk: params.get('risk') !== 'false',
			records: params.get('records') === 'true'
		};

		const analysis = await loadAnalysis(user.id);
		if (analysis.metrics.isEmpty) error(400, 'There are no records to report on yet.');

		// Dynamic import keeps pdf-lib out of every other bundle.
		const { buildPortfolioReport, pdfResponse } = await import('$lib/exporters/pdf');
		const bytes = await buildPortfolioReport(analysis.metrics, {
			title: 'Net worth statement',
			userName: user.name,
			baseCurrency: analysis.settings.baseCurrency,
			locale: analysis.settings.locale,
			displayDecimals: analysis.settings.displayDecimals,
			from: analysis.snapshots[0]?.snapshotDate ?? analysis.asOf,
			to: analysis.asOf,
			generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
			sections,
			includesProjections: false
		});

		log('info', { event: 'export.pdf', user: user.id });
		return pdfResponse(`wealthscope-report-${analysis.asOf}.pdf`, bytes);
	});

export type App = typeof app;

const handle = ({ request }: { request: Request }) => app.handle(request);
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
