import { Decimal, ZERO, dec, divide } from './money';
import type { ConvertedAsset } from './net-worth';
import type { PricePoint } from './types';

/**
 * Risk metrics.
 *
 * Every function here reports how much history it had. Below `MIN_OBSERVATIONS`
 * the result is null and the screen shows an insufficient-data state — the engine
 * never substitutes a class-level assumption and presents it as a measurement.
 */

/** Monthly observations needed before a volatility figure is published. */
export const MIN_OBSERVATIONS = 24;
/** Overlapping observations needed before a correlation is published. */
export const MIN_CORRELATION_OVERLAP = 12;

export const MONTHS_PER_YEAR = 12;

export interface SeriesQuality {
	observations: number;
	sufficient: boolean;
}

/** Simple period returns from a price series, oldest first. */
export function periodReturns(points: readonly PricePoint[]): Decimal[] {
	const ordered = [...points].sort((a, b) => a.priceDate.localeCompare(b.priceDate));
	const returns: Decimal[] = [];
	for (let i = 1; i < ordered.length; i++) {
		const prev = dec(ordered[i - 1].price);
		const current = dec(ordered[i].price);
		if (prev.lessThanOrEqualTo(0)) continue;
		returns.push(current.dividedBy(prev).minus(1));
	}
	return returns;
}

export function mean(values: readonly Decimal[]): Decimal | null {
	if (values.length === 0) return null;
	const total = values.reduce<Decimal>((acc, v) => acc.plus(v), ZERO);
	return total.dividedBy(values.length);
}

/** Sample standard deviation (n − 1). Null below two observations. */
export function standardDeviation(values: readonly Decimal[]): Decimal | null {
	if (values.length < 2) return null;
	const avg = mean(values)!;
	const variance = values
		.reduce<Decimal>((acc, v) => acc.plus(v.minus(avg).pow(2)), ZERO)
		.dividedBy(values.length - 1);
	return variance.sqrt();
}

export interface VolatilityResult {
	/** Annualised standard deviation as a percentage, or null. */
	annualised: Decimal | null;
	quality: SeriesQuality;
}

export function volatility(points: readonly PricePoint[]): VolatilityResult {
	const returns = periodReturns(points);
	const quality = { observations: returns.length, sufficient: returns.length >= MIN_OBSERVATIONS };
	if (!quality.sufficient) return { annualised: null, quality };
	const sd = standardDeviation(returns);
	if (sd === null) return { annualised: null, quality };
	return { annualised: sd.times(Decimal.sqrt(MONTHS_PER_YEAR)).times(100), quality };
}

export interface DrawdownResult {
	/** Largest peak-to-trough fall as a negative percentage, or null. */
	maxDrawdown: Decimal | null;
	peakDate: string | null;
	troughDate: string | null;
	quality: SeriesQuality;
}

export function maxDrawdown(points: readonly PricePoint[]): DrawdownResult {
	const ordered = [...points].sort((a, b) => a.priceDate.localeCompare(b.priceDate));
	const quality = { observations: ordered.length, sufficient: ordered.length >= 2 };
	if (!quality.sufficient) {
		return { maxDrawdown: null, peakDate: null, troughDate: null, quality };
	}

	let peak = dec(ordered[0].price);
	let peakDate = ordered[0].priceDate;
	let worst = ZERO;
	let worstPeakDate: string | null = null;
	let worstTroughDate: string | null = null;

	for (const point of ordered) {
		const value = dec(point.price);
		if (value.greaterThan(peak)) {
			peak = value;
			peakDate = point.priceDate;
			continue;
		}
		if (peak.isZero()) continue;
		const drawdown = value.minus(peak).dividedBy(peak);
		if (drawdown.lessThan(worst)) {
			worst = drawdown;
			worstPeakDate = peakDate;
			worstTroughDate = point.priceDate;
		}
	}

	return {
		maxDrawdown: worst.times(100),
		peakDate: worstPeakDate,
		troughDate: worstTroughDate,
		quality
	};
}

export interface CorrelationCell {
	value: Decimal | null;
	overlap: number;
	sufficient: boolean;
}

/**
 * Pearson correlation over dates present in both series. Pairs without enough
 * overlapping history return null, and the caller marks the diversification score
 * low-confidence rather than filling the cell with a guess.
 */
export function correlation(a: readonly PricePoint[], b: readonly PricePoint[]): CorrelationCell {
	const mapA = new Map(a.map((p) => [p.priceDate, dec(p.price)]));
	const mapB = new Map(b.map((p) => [p.priceDate, dec(p.price)]));
	const dates = [...mapA.keys()].filter((d) => mapB.has(d)).sort();

	const seriesA: Decimal[] = [];
	const seriesB: Decimal[] = [];
	for (let i = 1; i < dates.length; i++) {
		const prevA = mapA.get(dates[i - 1])!;
		const prevB = mapB.get(dates[i - 1])!;
		if (prevA.lessThanOrEqualTo(0) || prevB.lessThanOrEqualTo(0)) continue;
		seriesA.push(mapA.get(dates[i])!.dividedBy(prevA).minus(1));
		seriesB.push(mapB.get(dates[i])!.dividedBy(prevB).minus(1));
	}

	const overlap = seriesA.length;
	if (overlap < MIN_CORRELATION_OVERLAP) {
		return { value: null, overlap, sufficient: false };
	}

	const meanA = mean(seriesA)!;
	const meanB = mean(seriesB)!;
	let covariance = ZERO;
	let varA = ZERO;
	let varB = ZERO;
	for (let i = 0; i < overlap; i++) {
		const da = seriesA[i].minus(meanA);
		const db = seriesB[i].minus(meanB);
		covariance = covariance.plus(da.times(db));
		varA = varA.plus(da.pow(2));
		varB = varB.plus(db.pow(2));
	}

	const denominator = varA.times(varB).sqrt();
	if (denominator.isZero()) return { value: null, overlap, sufficient: false };
	return { value: covariance.dividedBy(denominator), overlap, sufficient: true };
}

export interface CorrelationMatrix {
	labels: string[];
	cells: CorrelationCell[][];
	/** True when every pair had enough overlap. */
	complete: boolean;
}

export function correlationMatrix(
	series: readonly { label: string; points: PricePoint[] }[]
): CorrelationMatrix {
	const labels = series.map((s) => s.label);
	const cells: CorrelationCell[][] = [];
	let complete = series.length > 0;

	for (let i = 0; i < series.length; i++) {
		const row: CorrelationCell[] = [];
		for (let j = 0; j < series.length; j++) {
			if (i === j) {
				row.push({ value: new Decimal(1), overlap: series[i].points.length, sufficient: true });
				continue;
			}
			const cell = correlation(series[i].points, series[j].points);
			if (!cell.sufficient) complete = false;
			row.push(cell);
		}
		cells.push(row);
	}

	return { labels, cells, complete };
}

/**
 * Sharpe ratio. Requires an explicit risk-free rate — there is no sane default, so
 * without one the function returns null rather than assuming zero.
 */
export function sharpeRatio(
	annualisedReturnPercent: Decimal | null,
	annualisedVolatilityPercent: Decimal | null,
	riskFreeRatePercent: Decimal | null
): Decimal | null {
	if (
		annualisedReturnPercent === null ||
		annualisedVolatilityPercent === null ||
		riskFreeRatePercent === null ||
		annualisedVolatilityPercent.isZero()
	) {
		return null;
	}
	return annualisedReturnPercent.minus(riskFreeRatePercent).dividedBy(annualisedVolatilityPercent);
}

export interface CurrencyExposure {
	currency: string;
	value: Decimal;
	share: Decimal | null;
}

export function currencyExposure(
	assets: readonly ConvertedAsset[],
	total: Decimal
): CurrencyExposure[] {
	const byCurrency = new Map<string, Decimal>();
	for (const a of assets) {
		const code = a.asset.currency.toUpperCase();
		byCurrency.set(code, (byCurrency.get(code) ?? ZERO).plus(a.baseValue));
	}
	return [...byCurrency.entries()]
		.map(([currency, value]) => ({
			currency,
			value,
			share: divide(value, total)?.times(100) ?? null
		}))
		.sort((a, b) => b.value.comparedTo(a.value));
}

export interface StressScenario {
	id: string;
	label: string;
	note: string;
	/** Shock applied to the matching exposure, as a negative percentage. */
	shockPercent: Decimal;
	/** Which slice of the balance sheet the shock lands on. */
	applyTo: 'equity' | 'portfolio' | 'bond' | 'property';
}

/**
 * Static shock vectors shipped with the app and applied to current weights. No
 * historical market data is stored or redistributed.
 */
export const STRESS_SCENARIOS: readonly StressScenario[] = [
	{
		id: 'equity-30',
		label: 'Global equity −30%',
		note: '2008-style repricing',
		shockPercent: new Decimal(-30),
		applyTo: 'equity'
	},
	{
		id: 'rapid-20',
		label: 'Rapid drawdown −20%',
		note: '2020-style, one quarter',
		shockPercent: new Decimal(-20),
		applyTo: 'portfolio'
	},
	{
		id: 'rates-200bp',
		label: 'Rates +200bp',
		note: 'Bond revaluation, mortgage reset',
		shockPercent: new Decimal(-9),
		applyTo: 'bond'
	},
	{
		id: 'house-15',
		label: 'House prices −15%',
		note: 'Local market correction',
		shockPercent: new Decimal(-15),
		applyTo: 'property'
	}
];

export interface StressResult {
	scenario: StressScenario;
	exposure: Decimal;
	impact: Decimal;
}

export function runStressTests(
	exposures: { equity: Decimal; portfolio: Decimal; bond: Decimal; property: Decimal },
	scenarios: readonly StressScenario[] = STRESS_SCENARIOS
): StressResult[] {
	return scenarios.map((scenario) => {
		const exposure = exposures[scenario.applyTo];
		return {
			scenario,
			exposure,
			impact: exposure.times(scenario.shockPercent).dividedBy(100)
		};
	});
}
