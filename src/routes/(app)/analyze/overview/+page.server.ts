import { fail } from '@sveltejs/kit';
import { evaluateFindings, severityTagClass } from '$engine/findings';
import { formatMoney, formatPercent, type Decimal } from '$engine/money';
import { requireUser, requireUserOrFail } from '$lib/server/authorization';
import { latestSnapshot } from '$lib/server/repositories/snapshots';
import { loadAnalysis } from '$lib/server/services/portfolio';
import { attempt, ok } from '$lib/server/services/result';
import { captureSnapshot } from '$lib/server/services/snapshots';
import { consume } from '$lib/server/security/rate-limit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const [analysis, snapshot] = await Promise.all([loadAnalysis(user.id), latestSnapshot(user.id)]);
	const { metrics, settings } = analysis;

	// Findings are generated on the server so the same rules produce the same copy
	// on the screen and in the PDF report.
	const money = (value: Decimal) =>
		formatMoney(value, settings.baseCurrency, {
			locale: settings.locale,
			decimals: settings.displayDecimals
		});

	const findings = evaluateFindings(metrics, {
		money,
		percent: (value, decimals = 1) => formatPercent(value, { decimals }),
		number: (value, decimals = 2) => value.toFixed(decimals)
	}).map((finding) => ({ ...finding, tagClass: severityTagClass(finding.severity) }));

	return {
		metrics,
		findings,
		lastRun: snapshot ? snapshot.snapshotDate : null,
		asOf: analysis.asOf
	};
};

export const actions: Actions = {
	/**
	 * Running the analysis recomputes on the server and records a snapshot for the
	 * day. Snapshots are what the net-worth trend and the trajectory score read.
	 */
	run: async (event) => {
		const user = requireUserOrFail(event);

		const limit = await consume('report', user.id);
		if (!limit.allowed) {
			return fail(429, {
				success: false as const,
				errors: { _form: ['Too many analysis runs. Try again shortly.'] },
				values: {}
			});
		}

		const result = await attempt(
			{ event: 'analysis.run', route: '/analyze/overview', user: user.id },
			() => captureSnapshot(user.id)
		);
		if (!result.ok) return fail(500, result.failure);

		return ok('Analysis complete. A snapshot has been recorded for today.');
	}
};
