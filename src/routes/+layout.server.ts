import type { LayoutServerLoad } from './$types';

/**
 * Only the identity every layer needs. Financial data is loaded by the routes
 * that show it, so a public page never triggers a portfolio query.
 */
export const load: LayoutServerLoad = ({ locals }) => {
	return { user: locals.user };
};
