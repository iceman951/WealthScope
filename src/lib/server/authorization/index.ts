import { error, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { AuthenticatedUser } from '$lib/types/session';

/**
 * Authorization primitives.
 *
 * The authenticated server session is the only source of the current user id.
 * A `userId` arriving in a form body, a query string or a JSON payload is never
 * read — every repository takes the id from here.
 */

/** For page loads: send the visitor to sign in and bring them back afterwards. */
export function requireUser(event: RequestEvent): AuthenticatedUser {
	const user = event.locals.user;
	if (!user) {
		const target = `${event.url.pathname}${event.url.search}`;
		redirect(303, `/login?redirectTo=${encodeURIComponent(target)}`);
	}
	return user;
}

/** For actions and endpoints, where a redirect would be the wrong answer. */
export function requireUserOrFail(event: RequestEvent): AuthenticatedUser {
	const user = event.locals.user;
	if (!user) {
		error(401, 'You need to be signed in to do that.');
	}
	return user;
}

/**
 * Guards a record fetched by id. A record belonging to someone else is reported
 * as 404, not 403 — telling an attacker that an id exists is itself a leak.
 */
export function assertOwnership<T extends { userId: string }>(
	record: T | undefined | null,
	userId: string,
	label = 'record'
): T {
	if (!record || record.userId !== userId) {
		error(404, `That ${label} was not found.`);
	}
	return record;
}

/** Non-throwing variant, for services that want to branch instead of abort. */
export function ownsRecord(record: { userId: string } | null | undefined, userId: string): boolean {
	return !!record && record.userId === userId;
}
