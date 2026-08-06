import { requireUser } from '$lib/server/authorization';
import { correlationMatrix, maxDrawdown, volatility } from '$engine/risk';
import { loadAnalysis, loadPriceSeries } from '$lib/server/services/portfolio';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const analysis = await loadAnalysis(user.id);
	const { metrics } = analysis;

	const holdings = metrics.portfolio.holdings;
	const series = await loadPriceSeries(
		user.id,
		holdings.map((h) => h.assetId)
	);

	const volatilities = holdings
		.map((holding) => {
			const points = series.get(holding.assetId) ?? [];
			const vol = volatility(points);
			const drawdown = maxDrawdown(points);
			return {
				assetId: holding.assetId,
				label: holding.symbol ? `${holding.symbol} — ${holding.sleeve}` : holding.name,
				annualised: vol.annualised,
				observations: vol.quality.observations,
				sufficient: vol.quality.sufficient,
				maxDrawdown: drawdown.maxDrawdown,
				drawdownSufficient: drawdown.quality.sufficient
			};
		})
		.sort((a, b) => {
			if (a.annualised === null) return 1;
			if (b.annualised === null) return -1;
			return b.annualised.comparedTo(a.annualised);
		});

	// Only holdings with usable history enter the matrix — a cell computed from
	// three observations is noise, not a correlation.
	const correlatable = holdings.filter((h) => (series.get(h.assetId)?.length ?? 0) >= 13);
	const matrix = correlationMatrix(
		correlatable.map((h) => ({
			label: h.symbol ?? h.name,
			points: series.get(h.assetId) ?? []
		}))
	);

	const cells = matrix.cells.flatMap((row, y) =>
		row.map(
			(cell, x) => [x, y, cell.value === null ? null : Number(cell.value.toFixed(4))] as const
		)
	);

	// Portfolio-level volatility needs a portfolio return series, which requires
	// overlapping history across every holding. Reported only when it exists.
	const portfolioObservations = Math.min(
		...holdings.map((h) => series.get(h.assetId)?.length ?? 0),
		Number.MAX_SAFE_INTEGER
	);

	return {
		metrics,
		volatilities,
		correlation: { labels: matrix.labels, cells, complete: matrix.complete },
		portfolioObservations: holdings.length === 0 ? 0 : portfolioObservations,
		holdingCount: holdings.length
	};
};
