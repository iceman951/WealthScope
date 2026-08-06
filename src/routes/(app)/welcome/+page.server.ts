import { fail, redirect } from '@sveltejs/kit';
import { onboardingBasicsSchema } from '$lib/schemas/settings';
import { requireUser, requireUserOrFail } from '$lib/server/authorization';
import { getSettings, markOnboarded, upsertSettings } from '$lib/server/repositories/settings';
import { attempt, ok, parseForm } from '$lib/server/services/result';
import { safeRedirect } from '$lib/utils/redirect';
import type { Actions, PageServerLoad } from './$types';

/**
 * First-run wizard: three steps, each a query parameter so a step is linkable and
 * testable in isolation. State lives in the settings row, not in a cookie.
 */
export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const settings = await getSettings(user.id);

	const raw = Number(event.url.searchParams.get('step') ?? 1);
	const step = Number.isInteger(raw) && raw >= 1 && raw <= 3 ? raw : 1;

	return { step, settings, name: user.name };
};

export const actions: Actions = {
	basics: async (event) => {
		const user = requireUserOrFail(event);
		const parsed = parseForm(onboardingBasicsSchema, await event.request.formData());
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'onboarding.basics', route: '/welcome', user: user.id, values: parsed.values },
			() => upsertSettings(user.id, parsed.value)
		);
		if (!result.ok) return fail(500, result.failure);

		redirect(303, '/welcome?step=3');
	},

	finish: async (event) => {
		const user = requireUserOrFail(event);
		const result = await attempt(
			{ event: 'onboarding.finish', route: '/welcome', user: user.id },
			() => markOnboarded(user.id)
		);
		if (!result.ok) return fail(500, result.failure);

		const destination = String((await event.request.formData()).get('next') ?? '');
		redirect(303, safeRedirect(destination));
	},

	skip: async (event) => {
		const user = requireUserOrFail(event);
		await markOnboarded(user.id);
		return ok('Setup skipped. You can change everything in Settings.');
	}
};
