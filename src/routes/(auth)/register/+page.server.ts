import { fail, redirect } from '@sveltejs/kit';
import { registerSchema } from '$lib/schemas/auth';
import { getAuth } from '$lib/server/auth';
import { applyAuthCookies } from '$lib/server/auth/cookies';
import { clientKey, consume } from '$lib/server/security/rate-limit';
import { log } from '$lib/server/security/logging';
import { formError, parseForm } from '$lib/server/services/result';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async (event) => {
		const data = await event.request.formData();
		const parsed = parseForm(registerSchema, data);
		if (!parsed.ok) return fail(400, parsed.failure);

		const limit = await consume('register', clientKey(event.request));
		if (!limit.allowed) {
			return fail(
				429,
				formError(
					`Too many sign-ups from this address. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.`,
					parsed.values
				)
			);
		}

		try {
			const { headers } = await getAuth().api.signUpEmail({
				body: {
					name: parsed.value.name,
					email: parsed.value.email,
					password: parsed.value.password
				},
				headers: event.request.headers,
				returnHeaders: true
			});
			applyAuthCookies(event.cookies, headers);
		} catch (err) {
			log('warn', {
				event: 'auth.register_failed',
				reason: err instanceof Error ? err.name : 'unknown'
			});
			// Deliberately ambiguous: a distinct "already registered" message would
			// confirm which addresses hold accounts.
			return fail(
				400,
				formError(
					'That account could not be created. If you already have one, sign in instead.',
					parsed.values
				)
			);
		}

		// New accounts land in the three-step first-run wizard.
		redirect(303, '/welcome');
	}
};
