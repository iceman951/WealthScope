import Decimal from 'decimal.js';
import { ZERO_DECIMAL_CURRENCIES } from '$lib/types/domain';

/**
 * Exact money arithmetic.
 *
 * Every canonical figure in WealthScope is a Decimal built from the exact string
 * PostgreSQL returned for a `numeric` column. Binary floating point is never used
 * for a persisted or reported value; `number` appears only where a value is on its
 * way to a CSS width or an SVG coordinate.
 *
 * Rounding policy
 *   - Intermediate arithmetic keeps 40 significant digits and is never rounded.
 *   - Persistence rounds to the column scale (8 dp for money) with HALF_EVEN,
 *     which does not drift upward across many operations.
 *   - Display rounds with HALF_UP, the convention users expect on a statement,
 *     and only at the moment of formatting.
 */

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN, toExpPos: 40, toExpNeg: -40 });

export { Decimal };

export type DecimalInput = Decimal | string | number | null | undefined;

/** Scale of the `numeric(24, 8)` money columns. */
export const STORAGE_SCALE = 8;
export const DISPLAY_ROUNDING = Decimal.ROUND_HALF_UP;
export const STORAGE_ROUNDING = Decimal.ROUND_HALF_EVEN;

export const ZERO = new Decimal(0);
export const ONE = new Decimal(1);
export const HUNDRED = new Decimal(100);

/**
 * Parses a database value into a Decimal. Null, undefined, empty string and
 * non-finite input all collapse to zero rather than NaN, so one missing optional
 * column cannot poison a whole portfolio total.
 */
export function dec(value: DecimalInput): Decimal {
	if (value === null || value === undefined || value === '') return ZERO;
	if (value instanceof Decimal) return value;
	try {
		const d = new Decimal(value);
		return d.isFinite() ? d : ZERO;
	} catch {
		return ZERO;
	}
}

/** Like `dec`, but reports unparseable input instead of hiding it. Used by validation. */
export function tryDec(value: DecimalInput): Decimal | null {
	if (value === null || value === undefined || value === '') return null;
	if (value instanceof Decimal) return value.isFinite() ? value : null;
	try {
		const d = new Decimal(value);
		return d.isFinite() ? d : null;
	} catch {
		return null;
	}
}

export function sum(values: readonly DecimalInput[]): Decimal {
	return values.reduce<Decimal>((acc, v) => acc.plus(dec(v)), ZERO);
}

export function sumBy<T>(items: readonly T[], pick: (item: T) => DecimalInput): Decimal {
	return items.reduce<Decimal>((acc, item) => acc.plus(dec(pick(item))), ZERO);
}

export function maxOf(values: readonly DecimalInput[]): Decimal {
	return values.reduce<Decimal>((acc, v, i) => {
		const d = dec(v);
		return i === 0 || d.greaterThan(acc) ? d : acc;
	}, ZERO);
}

/**
 * Safe division. Returns null when the denominator is zero rather than Infinity,
 * so callers must decide what "no denominator" means on their screen (usually an
 * insufficient-data state, never 0%).
 */
export function divide(numerator: DecimalInput, denominator: DecimalInput): Decimal | null {
	const d = dec(denominator);
	if (d.isZero()) return null;
	return dec(numerator).dividedBy(d);
}

/** Share of a total, as a percentage. Null when the total is zero. */
export function percentOf(part: DecimalInput, total: DecimalInput): Decimal | null {
	const ratio = divide(part, total);
	return ratio === null ? null : ratio.times(HUNDRED);
}

/** Rounds to the money column's scale, ready to be handed to Drizzle as a string. */
export function toStorage(value: DecimalInput, scale = STORAGE_SCALE): string {
	return dec(value).toFixed(scale, STORAGE_ROUNDING);
}

/** Decimal places a currency is quoted in. */
export function currencyDecimals(currency: string): number {
	return (ZERO_DECIMAL_CURRENCIES as readonly string[]).includes(currency.toUpperCase()) ? 0 : 2;
}

export function roundForDisplay(value: DecimalInput, decimals: number): Decimal {
	return dec(value).toDecimalPlaces(decimals, DISPLAY_ROUNDING);
}

export interface MoneyFormatOptions {
	locale?: string;
	/** Overrides the currency's own minor-unit count — the Rounding preference. */
	decimals?: number;
	/** Renders "+1,200" for positive values, as the design does for gains and net flow. */
	signed?: boolean;
	/** Drops the currency symbol, e.g. inside a column already labelled with it. */
	bare?: boolean;
}

const MINUS = '−'; // U+2212 MINUS SIGN — the design uses it, not a hyphen.

/**
 * Formats an exact amount for display. The Decimal is rounded once, here, and the
 * result is a string — no float ever represents the number the user reads.
 */
export function formatMoney(
	value: DecimalInput,
	currency: string,
	options: MoneyFormatOptions = {}
): string {
	const { locale = 'en-US', signed = false, bare = false } = options;
	const decimals = options.decimals ?? currencyDecimals(currency);
	const rounded = roundForDisplay(value, decimals);
	const isNegative = rounded.isNegative() && !rounded.isZero();
	const magnitude = rounded.abs();

	// Intl formats a JS number; feeding it the already-rounded magnitude means the
	// float conversion can no longer change any digit the user sees.
	const formatter = new Intl.NumberFormat(locale, {
		style: bare ? 'decimal' : 'currency',
		currency: bare ? undefined : currency,
		currencyDisplay: 'narrowSymbol',
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	});

	let body: string;
	try {
		body = formatter.format(magnitude.toNumber());
	} catch {
		// Unknown ISO code: fall back to "CODE 1,234.00".
		body = `${currency} ${magnitude.toFixed(decimals)}`;
	}

	if (isNegative) return `${MINUS}${body}`;
	if (signed && !rounded.isZero()) return `+${body}`;
	return body;
}

export interface PercentFormatOptions {
	decimals?: number;
	signed?: boolean;
}

export function formatPercent(value: DecimalInput, options: PercentFormatOptions = {}): string {
	const { decimals = 1, signed = false } = options;
	const rounded = roundForDisplay(value, decimals);
	const isNegative = rounded.isNegative() && !rounded.isZero();
	const body = `${rounded.abs().toFixed(decimals)}%`;
	if (isNegative) return `${MINUS}${body}`;
	if (signed && !rounded.isZero()) return `+${body}`;
	return body;
}

/** Insufficient data is shown as an em dash, never as zero. */
export const NO_DATA = '—';

export function formatOptionalPercent(
	value: Decimal | null | undefined,
	options: PercentFormatOptions = {}
): string {
	return value === null || value === undefined ? NO_DATA : formatPercent(value, options);
}

export function formatQuantity(value: DecimalInput, maxDecimals = 6): string {
	const d = dec(value);
	// Trailing zeros are noise on a share count; keep only the places in use.
	const trimmed = d.toDecimalPlaces(maxDecimals, DISPLAY_ROUNDING);
	return trimmed.toFixed(Math.min(maxDecimals, Math.max(0, trimmed.decimalPlaces())));
}

/** Percentage clamped to 0–100 for a bar width. Presentation only. */
export function barWidth(value: Decimal | null | undefined): number {
	if (value === null || value === undefined) return 0;
	const clamped = Decimal.min(Decimal.max(value, 0), 100);
	return Number(clamped.toFixed(2));
}
