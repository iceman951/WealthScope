import { isHttpError, isRedirect } from '@sveltejs/kit';
import type { z } from 'zod';
import { fieldErrors, formToObject, type FieldErrors } from '$lib/schemas/common';
import { reportUnexpected } from '../security/logging';

/**
 * The single shape every form action returns, so `ActionData` is uniform and the
 * form components have one contract to render against.
 */

export interface ActionFailure {
	success: false;
	errors: FieldErrors;
	/** The values the user typed, so the form re-renders without losing work. */
	values: Record<string, string>;
	message?: string;
	/** Correlation id for an unexpected server error. */
	code?: string;
}

export interface ActionSuccess<T = undefined> {
	success: true;
	message: string;
	data?: T;
}

export type ActionResult<T = undefined> = ActionSuccess<T> | ActionFailure;

export function invalid(
	errors: FieldErrors,
	values: Record<string, string>,
	message?: string
): ActionFailure {
	return { success: false, errors, values, message };
}

export function formError(
	message: string,
	values: Record<string, string> = {},
	code?: string
): ActionFailure {
	return { success: false, errors: { _form: [message] }, values, message, code };
}

export function ok<T>(message: string, data?: T): ActionSuccess<T> {
	return { success: true, message, data };
}

/**
 * Parses submitted form data against a schema, stripping fields that must never
 * survive a round trip (passwords) from the echoed values.
 */
export function parseForm<S extends z.ZodType>(
	schema: S,
	data: FormData,
	options: { redactFields?: readonly string[] } = {}
):
	| { ok: true; value: z.output<S>; values: Record<string, string> }
	| { ok: false; failure: ActionFailure } {
	const raw = formToObject(data);
	const redact = new Set(
		options.redactFields ?? ['password', 'confirmPassword', 'currentPassword', 'newPassword']
	);
	const values = Object.fromEntries(Object.entries(raw).filter(([key]) => !redact.has(key)));

	const result = schema.safeParse(raw);
	if (!result.success) {
		return { ok: false, failure: invalid(fieldErrors(result.error), values) };
	}
	return { ok: true, value: result.data, values };
}

/**
 * Runs a service call inside an action.
 *
 * Deliberate `error()` and `redirect()` throws pass straight through — those are
 * the framework's control flow. Anything else is logged with a correlation id and
 * turned into one safe sentence; a driver message never reaches the browser.
 */
export async function attempt<T>(
	context: { event: string; route?: string; user?: string | null; values?: Record<string, string> },
	fn: () => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; failure: ActionFailure }> {
	try {
		return { ok: true, value: await fn() };
	} catch (err) {
		if (isHttpError(err) || isRedirect(err)) throw err;
		const { code, message } = reportUnexpected(context.event, err, {
			route: context.route,
			user: context.user
		});
		return { ok: false, failure: formError(message, context.values ?? {}, code) };
	}
}
