/**
 * Structured server logging.
 *
 * Financial values, CSV rows, email addresses and session tokens never reach a
 * log line. What is recorded is the shape of what happened — the operation, the
 * outcome, a hashed user reference and a correlation id the error page can show.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogFields {
	event: string;
	/** Correlates a user-facing error with this line. Safe to display. */
	code?: string;
	route?: string;
	status?: number;
	durationMs?: number;
	/** Row/record counts are fine; amounts are not. */
	count?: number;
	reason?: string;
}

/** A short, stable, non-reversible reference to a user for log correlation. */
export function userRef(userId: string | null | undefined): string {
	if (!userId) return 'anon';
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		hash = (hash * 31 + userId.charCodeAt(i)) | 0;
	}
	return `u_${(hash >>> 0).toString(36)}`;
}

export function newCorrelationId(): string {
	return crypto.randomUUID().slice(0, 8);
}

export function log(level: LogLevel, fields: LogFields & { user?: string | null }): void {
	const line = JSON.stringify({
		level,
		time: new Date().toISOString(),
		...fields,
		user: userRef(fields.user)
	});
	if (level === 'error') console.error(line);
	else if (level === 'warn') console.warn(line);
	else console.error(line); // Workers' console.log is dropped at some log levels.
}

/**
 * Turns an unknown thrown value into a safe message plus a correlation code.
 * The raw error goes to the log; the user gets the code and a generic sentence.
 */
export function reportUnexpected(
	event: string,
	err: unknown,
	context: { route?: string; user?: string | null } = {}
): { code: string; message: string } {
	const code = newCorrelationId();
	log('error', {
		event,
		code,
		route: context.route,
		user: context.user,
		reason: err instanceof Error ? err.name : typeof err
	});
	// The message itself is deliberately not the database's. Raw driver errors can
	// carry table names, constraint text and occasionally row values.
	return {
		code,
		message: 'Something went wrong on our side. Nothing was saved. Please try again.'
	};
}
