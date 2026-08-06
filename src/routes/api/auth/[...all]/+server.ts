import { getAuth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/**
 * Better Auth's own endpoints. `hooks.server.ts` routes these to the library's
 * handler before this file is reached; these exports exist so SvelteKit knows the
 * route accepts GET and POST and does not 405 first.
 */
export const GET: RequestHandler = ({ request }) => getAuth().handler(request);
export const POST: RequestHandler = ({ request }) => getAuth().handler(request);
