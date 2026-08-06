import { error } from '@sveltejs/kit';
import { requireUserOrFail } from '$lib/server/authorization';
import { loadAnalysis } from '$lib/server/services/portfolio';
import { consume } from '$lib/server/security/rate-limit';
import { log } from '$lib/server/security/logging';
import type { RequestHandler } from './$types';

/**
 * PDF report generation.
 *
 * pdf-lib is imported dynamically inside the exporter, so the library is only
 * fetched when a report is actually requested — it never reaches the dashboard.
 */
export const GET: RequestHandler = async (event) => {
	const user = requireUserOrFail(event);

	const limit = await consume('report', user.id);
	if (!limit.allowed) {
		error(429, `Too many reports. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.`);
	}

	const params = event.url.searchParams;
	const sections = {
		netWorth: params.get('netWorth') !== 'false',
		allocation: params.get('allocation') !== 'false',
		risk: params.get('risk') !== 'false',
		records: params.get('records') === 'true'
	};

	const analysis = await loadAnalysis(user.id);
	if (analysis.metrics.isEmpty) {
		error(400, 'There are no records to report on yet.');
	}

	const from = analysis.snapshots[0]?.snapshotDate ?? analysis.asOf;
	// Both helpers come from the dynamic import, so pdf-lib stays out of every
	// other bundle in the application.
	const { buildPortfolioReport, pdfResponse } = await import('$lib/exporters/pdf');

	const bytes = await buildPortfolioReport(analysis.metrics, {
		title: 'Net worth statement',
		userName: user.name,
		baseCurrency: analysis.settings.baseCurrency,
		locale: analysis.settings.locale,
		displayDecimals: analysis.settings.displayDecimals,
		from,
		to: analysis.asOf,
		generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
		sections,
		includesProjections: false
	});

	log('info', { event: 'export.pdf', user: user.id });

	return pdfResponse(`wealthscope-report-${analysis.asOf}.pdf`, bytes);
};
