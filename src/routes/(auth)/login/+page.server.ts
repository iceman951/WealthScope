import { fail, redirect } from '@sveltejs/kit';
import { loginSchema } from '$lib/schemas/auth';
import { getAuth } from '$lib/server/auth';
import { applyAuthCookies } from '$lib/server/auth/cookies';
import { clientKey, consume } from '$lib/server/security/rate-limit';
import { log } from '$lib/server/security/logging';
import { formError, parseForm } from '$lib/server/services/result';
import { safeRedirect } from '$lib/utils/redirect';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	return { redirectTo: safeRedirect(url.searchParams.get('redirectTo')) };
};

export const actions: Actions = {
	default: async (event) => {
		const data = await event.request.formData();
		const parsed = parseForm(loginSchema, data);
		if (!parsed.ok) return fail(400, parsed.failure);

		const limit = await consume('login', clientKey(event.request));
		if (!limit.allowed) {
			return fail(
				429,
				formError(
					`Too many sign-in attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.`,
					parsed.values
				)
			);
		}

		try {
			const { headers } = await getAuth().api.signInEmail({
				body: { email: parsed.value.email, password: parsed.value.password },
				headers: event.request.headers,
				returnHeaders: true
			});
			const applied = applyAuthCookies(event.cookies, headers);
			if (applied === 0) throw new Error('no-session-cookie');
		} catch (err) {
			// One message covers "no such account" and "wrong password" alike:
			// telling them apart turns this form into an account-existence oracle.
			log('warn', {
				event: 'auth.login_failed',
				reason: err instanceof Error ? err.name : 'unknown'
			});
			return fail(
				400,
				formError('That email and password do not match an account.', parsed.values)
			);
		}

		redirect(303, safeRedirect(String(data.get('redirectTo') ?? '')));
	}
};
