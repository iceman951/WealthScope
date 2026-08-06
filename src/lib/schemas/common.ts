import { z } from 'zod';
import { tryDec } from '$engine/money';

/**
 * Shared validation primitives.
 *
 * Every schema here is used on the server. Where the browser validates too, it
 * imports the same schema — one definition, no drift between the two sides.
 */

/**
 * Membership check that keeps the literal union as the output type without a
 * type assertion, so adding a value to the domain list updates validation and
 * types together.
 */
export function enumOf<T extends string>(values: readonly T[], message: string) {
	return z.string().refine((value): value is T => (values as readonly string[]).includes(value), {
		message
	});
}

export const idSchema = z.string().uuid({ message: 'Not a valid record reference' });

export const currencyCodeSchema = z
	.string()
	.trim()
	.toUpperCase()
	.regex(/^[A-Z]{3}$/, { message: 'Use a three-letter currency code, e.g. THB' });

export const isoDateSchema = z
	.string()
	.trim()
	.regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use the format YYYY-MM-DD' })
	.refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
		message: 'That date does not exist'
	});

export const nameSchema = z
	.string()
	.trim()
	.min(1, { message: 'Give this a name' })
	.max(160, { message: 'Keep the name under 160 characters' });

export const notesSchema = z
	.string()
	.trim()
	.max(2000, { message: 'Notes are limited to 2000 characters' })
	.optional()
	.transform((value) => (value === undefined || value === '' ? null : value));

/**
 * A money-like string. Accepts what a user actually types — thousands separators,
 * a leading currency symbol, a Unicode minus — and normalises to an exact decimal
 * string. Never produces a JavaScript number.
 */
export function decimalString(options: {
	label: string;
	allowNegative?: boolean;
	max?: string;
	maxDecimals?: number;
}) {
	const { label, allowNegative = false, max, maxDecimals = 8 } = options;

	return z
		.string()
		.trim()
		.min(1, { message: `${label} is required` })
		.transform((raw) =>
			raw
				.replace(/[\s,_]/g, '')
				.replace(/^[^\d.\-−+]*/, '')
				.replace('−', '-')
		)
		.superRefine((value, ctx) => {
			const parsed = tryDec(value);
			if (parsed === null) {
				ctx.addIssue({ code: 'custom', message: `${label} must be a number` });
				return;
			}
			if (!allowNegative && parsed.isNegative()) {
				ctx.addIssue({ code: 'custom', message: `${label} cannot be negative` });
			}
			if (parsed.decimalPlaces() > maxDecimals) {
				ctx.addIssue({
					code: 'custom',
					message: `${label} supports at most ${maxDecimals} decimal places`
				});
			}
			if (max && parsed.abs().greaterThan(max)) {
				ctx.addIssue({ code: 'custom', message: `${label} is larger than this system supports` });
			}
		})
		.transform((value) => tryDec(value)!.toString());
}

/** Optional variant: an empty field means "not recorded", not zero. */
export function optionalDecimalString(options: Parameters<typeof decimalString>[0]) {
	return z
		.string()
		.optional()
		.transform((value) => (value === undefined ? '' : value.trim()))
		.transform((value) => (value === '' ? null : value))
		.superRefine((value, ctx) => {
			if (value === null) return;
			const result = decimalString(options).safeParse(value);
			if (!result.success) {
				for (const issue of result.error.issues) {
					ctx.addIssue({ code: 'custom', message: issue.message });
				}
			}
		})
		.transform((value) => (value === null ? null : decimalString(options).parse(value)));
}

/** Upper bound on any single money field: 10^16, comfortably inside numeric(24,8). */
export const MAX_MONEY = '10000000000000000';
export const MAX_QUANTITY = '1000000000000000000';

export const moneySchema = (label: string, allowNegative = false) =>
	decimalString({ label, allowNegative, max: MAX_MONEY, maxDecimals: 8 });

export const optionalMoneySchema = (label: string, allowNegative = false) =>
	optionalDecimalString({ label, allowNegative, max: MAX_MONEY, maxDecimals: 8 });

export const quantitySchema = (label: string) =>
	decimalString({ label, allowNegative: false, max: MAX_QUANTITY, maxDecimals: 12 });

export const optionalQuantitySchema = (label: string) =>
	optionalDecimalString({ label, allowNegative: false, max: MAX_QUANTITY, maxDecimals: 12 });

export const percentSchema = (label: string, allowNegative = false) =>
	decimalString({ label, allowNegative, max: '10000', maxDecimals: 8 });

export const optionalPercentSchema = (label: string, allowNegative = false) =>
	optionalDecimalString({ label, allowNegative, max: '10000', maxDecimals: 8 });

export const symbolSchema = z
	.string()
	.trim()
	.toUpperCase()
	.max(32, { message: 'Ticker symbols are at most 32 characters' })
	.optional()
	.transform((value) => (value === undefined || value === '' ? null : value));

export const optionalIdSchema = z
	.string()
	.optional()
	.transform((value) => (value === undefined || value === '' ? null : value))
	.refine((value) => value === null || idSchema.safeParse(value).success, {
		message: 'Not a valid record reference'
	});

export const optionalDateSchema = z
	.string()
	.optional()
	.transform((value) => (value === undefined || value.trim() === '' ? null : value.trim()))
	.refine((value) => value === null || isoDateSchema.safeParse(value).success, {
		message: 'Use the format YYYY-MM-DD'
	});

export const checkboxSchema = z
	.union([z.literal('on'), z.literal('true'), z.literal('false'), z.literal(''), z.undefined()])
	.transform((value) => value === 'on' || value === 'true');

export const paginationSchema = z.object({
	page: z.coerce.number().int().min(1).max(10_000).default(1),
	pageSize: z.coerce.number().int().min(1).max(200).default(25)
});

export type FieldErrors = Record<string, string[]>;

/**
 * Flattens a Zod error into `{ field: [messages] }` for the form components.
 * Written against `issues` rather than `flatten()` so it behaves the same across
 * Zod majors, and so nested paths collapse predictably.
 */
export function fieldErrors(error: z.ZodError): FieldErrors {
	const result: FieldErrors = {};
	for (const issue of error.issues) {
		const key = issue.path.length === 0 ? '_form' : issue.path.join('.');
		(result[key] ??= []).push(issue.message);
	}
	return result;
}

/** Turns a submitted FormData into the plain object the schemas expect. */
export function formToObject(data: FormData): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, value] of data.entries()) {
		if (typeof value === 'string') result[key] = value;
	}
	return result;
}
