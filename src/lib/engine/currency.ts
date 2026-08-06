import { Decimal, ONE, dec, type DecimalInput } from './money';

/**
 * Currency conversion.
 *
 * Values in different currencies are never added. Every cross-currency total goes
 * through `convert`, which either returns an exact converted Decimal together with
 * the rate it used, or reports the missing pair so the screen can show an
 * insufficient-data state instead of a wrong number.
 */

export interface RateQuote {
	base: string;
	quote: string;
	rate: Decimal;
	/** ISO date the rate was observed. Persisted alongside snapshots. */
	date: string;
}

export type RateTable = ReadonlyMap<string, RateQuote>;

export function rateKey(base: string, quote: string): string {
	return `${base.toUpperCase()}/${quote.toUpperCase()}`;
}

export function buildRateTable(
	quotes: readonly {
		baseCurrency: string;
		quoteCurrency: string;
		rate: DecimalInput;
		rateDate: string;
	}[]
): RateTable {
	const table = new Map<string, RateQuote>();
	for (const q of quotes) {
		const base = q.baseCurrency.toUpperCase();
		const quote = q.quoteCurrency.toUpperCase();
		const rate = dec(q.rate);
		if (rate.lessThanOrEqualTo(0)) continue;
		const key = rateKey(base, quote);
		const existing = table.get(key);
		// Keep the most recent observation for a pair.
		if (!existing || q.rateDate >= existing.date) {
			table.set(key, { base, quote, rate, date: q.rateDate });
		}
	}
	return table;
}

export interface ConversionOk {
	ok: true;
	value: Decimal;
	rate: Decimal;
	rateDate: string | null;
}

export interface ConversionMissing {
	ok: false;
	/** The pair that could not be resolved, e.g. "SGD/THB". */
	missing: string;
}

export type ConversionResult = ConversionOk | ConversionMissing;

/**
 * Resolves `from → to` directly, by inversion, or by triangulating through a
 * pivot currency present in the table. Returns the effective rate so a snapshot
 * can record exactly what was used.
 */
export function resolveRate(from: string, to: string, rates: RateTable): ConversionOk | null {
	const a = from.toUpperCase();
	const b = to.toUpperCase();
	if (a === b) return { ok: true, value: ONE, rate: ONE, rateDate: null };

	const direct = rates.get(rateKey(a, b));
	if (direct) return { ok: true, value: direct.rate, rate: direct.rate, rateDate: direct.date };

	const inverse = rates.get(rateKey(b, a));
	if (inverse && !inverse.rate.isZero()) {
		const r = ONE.dividedBy(inverse.rate);
		return { ok: true, value: r, rate: r, rateDate: inverse.date };
	}

	// Triangulate: a → pivot → b, preferring the freshest pair.
	for (const quote of rates.values()) {
		if (quote.base !== a) continue;
		const leg = rates.get(rateKey(quote.quote, b)) ?? null;
		if (leg) {
			const r = quote.rate.times(leg.rate);
			const date = quote.date < leg.date ? quote.date : leg.date;
			return { ok: true, value: r, rate: r, rateDate: date };
		}
		const inverseLeg = rates.get(rateKey(b, quote.quote));
		if (inverseLeg && !inverseLeg.rate.isZero()) {
			const r = quote.rate.dividedBy(inverseLeg.rate);
			const date = quote.date < inverseLeg.date ? quote.date : inverseLeg.date;
			return { ok: true, value: r, rate: r, rateDate: date };
		}
	}

	return null;
}

export function convert(
	amount: DecimalInput,
	from: string,
	to: string,
	rates: RateTable
): ConversionResult {
	const resolved = resolveRate(from, to, rates);
	if (!resolved) return { ok: false, missing: rateKey(from, to) };
	return {
		ok: true,
		value: dec(amount).times(resolved.rate),
		rate: resolved.rate,
		rateDate: resolved.rateDate
	};
}

export interface ConvertedTotal {
	total: Decimal;
	/** Pairs that could not be resolved. Non-empty means the total is incomplete. */
	missingRates: string[];
	/** Rates actually applied, keyed "FROM/TO" — recorded on snapshots. */
	appliedRates: Record<string, string>;
}

/**
 * Adds a set of amounts into one base currency, collecting every unresolved pair
 * rather than silently dropping or double-counting the rows behind them.
 */
export function convertAll(
	items: readonly { amount: DecimalInput; currency: string }[],
	baseCurrency: string,
	rates: RateTable
): ConvertedTotal {
	let total = new Decimal(0);
	const missing = new Set<string>();
	const applied: Record<string, string> = {};

	for (const item of items) {
		const result = convert(item.amount, item.currency, baseCurrency, rates);
		if (!result.ok) {
			missing.add(result.missing);
			continue;
		}
		total = total.plus(result.value);
		if (item.currency.toUpperCase() !== baseCurrency.toUpperCase()) {
			applied[rateKey(item.currency, baseCurrency)] = result.rate.toString();
		}
	}

	return { total, missingRates: [...missing].sort(), appliedRates: applied };
}
