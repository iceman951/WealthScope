import { redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/authorization';
import { getSettings } from '$lib/server/repositories/settings';
import { shellSummary } from '$lib/server/repositories/summary';
import type { LayoutServerLoad } from './$types';

/**
 * The protected layout. `hooks.server.ts` has already rejected unauthenticated
 * requests; `requireUser` re-asserts it here so a route added under this group
 * can never be reachable by forgetting to update the hook's prefix list.
 */
export const load: LayoutServerLoad = async (event) => {
	const user = requireUser(event);

	const [settings, summary] = await Promise.all([getSettings(user.id), shellSummary(user.id)]);

	// New accounts finish the three-step wizard before seeing an empty dashboard.
	if (!settings.onboardedAt && !event.url.pathname.startsWith('/welcome')) {
		redirect(303, '/welcome');
	}

	return { user, settings, summary };
};
