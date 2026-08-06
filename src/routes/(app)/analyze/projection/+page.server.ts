import { fail } from '@sveltejs/kit';
import { projectionAssumptionsSchema } from '$lib/schemas/settings';
import { requireUser, requireUserOrFail } from '$lib/server/authorization';
import { upsertSettings } from '$lib/server/repositories/settings';
import { loadAnalysis } from '$lib/server/services/portfolio';
import { attempt, ok, parseForm } from '$lib/server/services/result';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const analysis = await loadAnalysis(user.id);
	const { metrics, settings } = analysis;

	return {
		netWorth: metrics.netWorth.netWorth,
		monthlyNetFlow: metrics.cashflow.netCashflow,
		defaults: {
			annualReturnPercent: Number(settings.defaultReturnAssumption),
			annualInflationPercent: Number(settings.defaultInflationAssumption)
		},
		birthYear: settings.birthYear,
		retirementAge: settings.retirementAge,
		currentYear: Number(analysis.asOf.slice(0, 4))
	};
};

export const actions: Actions = {
	/** Persists the return and inflation assumptions as the account's defaults. */
	saveAssumptions: async (event) => {
		const user = requireUserOrFail(event);
		const parsed = parseForm(projectionAssumptionsSchema, await event.request.formData());
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{
				event: 'projection.save_assumptions',
				route: '/analyze/projection',
				user: user.id,
				values: parsed.values
			},
			() =>
				upsertSettings(user.id, {
					defaultReturnAssumption: String(parsed.value.annualReturnPercent),
					defaultInflationAssumption: String(parsed.value.annualInflationPercent)
				})
		);
		if (!result.ok) return fail(500, result.failure);

		return ok('Assumptions saved as your defaults.');
	}
};
