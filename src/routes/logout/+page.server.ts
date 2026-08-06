import { redirect } from '@sveltejs/kit';
import { getAuth } from '$lib/server/auth';
import { applyAuthCookies } from '$lib/server/auth/cookies';
import type { Actions, PageServerLoad } from './$types';

/** Signing out is a state change, so it is POST-only — never a link a page can trigger. */
export const load: PageServerLoad = () => {
	redirect(303, '/dashboard');
};

export const actions: Actions = {
	default: async (event) => {
		try {
			const { headers } = await getAuth().api.signOut({
				headers: event.request.headers,
				returnHeaders: true
			});
			applyAuthCookies(event.cookies, headers);
		} catch {
			// Even if the server-side revoke fails, clear the cookie so this browser
			// stops presenting a session.
			event.cookies.delete('wealthscope.session_token', { path: '/' });
		}
		redirect(303, '/login');
	}
};
