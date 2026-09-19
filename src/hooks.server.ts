import { building, dev } from '$app/environment';
import { redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { getAuth } from '$lib/server/auth';
import { bindDatabase, isDatabaseBound } from '$lib/server/db';
import { ensureDevSeed } from '$lib/server/db/dev-seed';
import { PRIVATE_CACHE_CONTROL, securityHeaders } from '$lib/server/security/headers';
import { log, newCorrelationId, userRef } from '$lib/server/security/logging';

/**
 * Request pipeline.
 *
 *  1. Resolve the session cookie into `event.locals.user`. This is the only place
 *     a user identity enters the application.
 *  2. Enforce authentication on every protected route on the server, before any
 *     load function runs. Client-side guards are convenience, never the control.
 *  3. Attach security headers, and mark personalised responses uncacheable.
 */

/** Everything under these prefixes requires a session. */
const PROTECTED_PREFIXES = [
	'/dashboard',
	'/accounts',
	'/assets',
	'/investments',
	'/liabilities',
	'/cashflow',
	'/analyze',
	'/reports',
	'/import',
	'/settings',
	'/welcome',
	'/api/assets',
	'/api/prices',
	'/api/imports',
	'/api/exports'
];

/** Signed-in users are bounced away from these. */
const GUEST_ONLY = ['/login', '/register'];

function isProtected(pathname: string): boolean {
	return PROTECTED_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
	);
}

const handleAuth: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.sessionId = null;

	// Prerendering has no request context and no session to resolve. Neither
	// does a prerenderable route in dev, which arrives here with no database
	// attached (see handleDatabase) — in production it is a static file.
	if (!building && isDatabaseBound()) {
		try {
			const auth = getAuth();
			const result = await auth.api.getSession({ headers: event.request.headers });
			if (result?.user) {
				event.locals.user = {
					id: result.user.id,
					email: result.user.email,
					name: result.user.name,
					emailVerified: result.user.emailVerified,
					image: result.user.image ?? null
				};
				event.locals.sessionId = result.session?.id ?? null;
			}
		} catch (err) {
			// A failed session lookup means "not signed in", never "signed in as
			// somebody". Protected routes below will redirect.
			log('warn', {
				event: 'session.resolve_failed',
				route: event.url.pathname,
				reason: err instanceof Error ? err.name : 'unknown'
			});
		}
	}

	const { pathname } = event.url;

	if (!event.locals.user && isProtected(pathname)) {
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Authentication required' }), {
				status: 401,
				headers: { 'content-type': 'application/json' }
			});
		}
		const target = `${pathname}${event.url.search}`;
		redirect(303, `/login?redirectTo=${encodeURIComponent(target)}`);
	}

	if (event.locals.user && GUEST_ONLY.includes(pathname)) {
		redirect(303, '/dashboard');
	}

	const response = await resolve(event);

	if (event.locals.user && !pathname.startsWith('/api/auth')) {
		response.headers.set('cache-control', PRIVATE_CACHE_CONTROL);
	}

	return response;
};

/**
 * Attaches the request's D1 binding before anything touches the database.
 *
 * `getDb()` is synchronous — it has to be, because `read()` is a default
 * parameter value across the repositories — and the binding only exists on
 * `event.platform`, so this is where the two meet. In `vite dev` the adapter
 * emulates `platform.env` from wrangler.jsonc, so the same code path serves the
 * local SQLite database and the deployed D1 database.
 *
 * It must sit outside `handleAuth`: that calls `getAuth()`, which builds the
 * Better Auth adapter around `getDb()` eagerly.
 */
const handleDatabase: Handle = async ({ event, resolve }) => {
	// Prerendering `/`, `/privacy` and `/terms` runs through this chain at build
	// time, where there is no binding and no database needed.
	if (!building) {
		const binding = d1Binding(event.platform);
		if (binding) {
			bindDatabase(binding);
			// Local development only: put the demo household into an empty database
			// so every screen has something to render. Memoised per process.
			if (dev) await ensureDevSeed();
		}
	}
	return resolve(event);
};

/**
 * The `DB` binding, or `null` on a prerenderable route.
 *
 * `/`, `/privacy` and `/terms` are prerendered at build time and served as
 * static files in production, so they never have a database. In `vite dev` the
 * adapter enforces that by handing those routes a `platform.env` whose every
 * property throws on access — which is what the try/catch is for. Any other
 * route without the binding is a configuration error worth failing loudly on.
 */
function d1Binding(platform: App.Platform | undefined): D1Database | null {
	try {
		const binding = platform?.env?.DB;
		if (binding) return binding;
	} catch {
		return null;
	}
	throw new Error(
		'No D1 binding named "DB" on platform.env. Declare it under d1_databases in wrangler.jsonc; `vite dev` picks it up through the platform proxy.'
	);
}

const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	for (const [name, value] of Object.entries(securityHeaders(dev))) {
		response.headers.set(name, value);
	}
	return response;
};

/** Better Auth owns everything under /api/auth. */
const handleBetterAuth: Handle = async ({ event, resolve }) => {
	if (building || !event.url.pathname.startsWith('/api/auth')) {
		return resolve(event);
	}
	return svelteKitHandler({ event, resolve, auth: getAuth(), building });
};

export const handle: Handle = async (input) => {
	return handleSecurityHeaders({
		event: input.event,
		resolve: (event) =>
			handleDatabase({
				event,
				resolve: (ready) =>
					handleAuth({
						event: ready,
						resolve: (inner) => handleBetterAuth({ event: inner, resolve: input.resolve })
					})
			})
	});
};

/**
 * Unexpected server errors: log the shape, show the user a correlation code, and
 * never leak a driver message or a stack trace into the response.
 */
export const handleError: HandleServerError = ({ error, event, status, message }) => {
	if (status === 404) {
		return { message: 'That page does not exist.', code: undefined };
	}

	const code = newCorrelationId();
	console.error(
		JSON.stringify({
			level: 'error',
			time: new Date().toISOString(),
			event: 'unhandled',
			code,
			route: event.route.id ?? event.url.pathname,
			status,
			user: userRef(event.locals.user?.id),
			reason: error instanceof Error ? `${error.name}: ${error.message}` : String(message)
		})
	);

	return {
		message: 'Something went wrong on our side. Nothing was saved.',
		code
	};
};
