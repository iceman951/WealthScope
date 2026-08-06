import { Decimal, ZERO, dec, type DecimalInput } from './money';

/**
 * Deterministic wealth projection.
 *
 * Monthly compounding of a starting net worth plus a contribution, with the
 * nominal path deflated by inflation to give today's-money figures. Pure: the
 * same assumptions always produce the same series, which is what the snapshot
 * tests assert.
 *
 * This is arithmetic on stated assumptions, not a forecast. Every surface that
 * shows it carries that disclaimer.
 */

export interface ProjectionAssumptions {
	/** Net worth at month zero, in the base currency. */
	initialNetWorth: DecimalInput;
	/** Added at the end of each month. */
	monthlyContribution: DecimalInput;
	/** Nominal annual return, as a percentage. */
	annualReturnPercent: DecimalInput;
	/** Annual inflation, as a percentage. */
	annualInflationPercent: DecimalInput;
	years: number;
	/** Optional annual growth of the contribution itself, as a percentage. */
	contributionGrowthPercent?: DecimalInput;
}

export interface ProjectionPoint {
	monthIndex: number;
	/** Fractional years elapsed, for axis labelling. */
	year: number;
	nominal: Decimal;
	/** Nominal deflated by inflation — the same money measured in today's terms. */
	real: Decimal;
	contributedToDate: Decimal;
}

export interface ProjectionResult {
	points: ProjectionPoint[];
	endingNominal: Decimal;
	endingReal: Decimal;
	totalContributions: Decimal;
	/** Ending nominal less the starting balance and everything contributed. */
	growth: Decimal;
	assumptions: {
		initialNetWorth: Decimal;
		monthlyContribution: Decimal;
		annualReturnPercent: Decimal;
		annualInflationPercent: Decimal;
		contributionGrowthPercent: Decimal;
		years: number;
	};
}

export const MAX_PROJECTION_YEARS = 50;

export function project(assumptions: ProjectionAssumptions): ProjectionResult {
	const initial = dec(assumptions.initialNetWorth);
	const baseContribution = dec(assumptions.monthlyContribution);
	const annualReturn = dec(assumptions.annualReturnPercent);
	const annualInflation = dec(assumptions.annualInflationPercent);
	const contributionGrowth = dec(assumptions.contributionGrowthPercent ?? 0);
	const years = Math.min(Math.max(Math.trunc(assumptions.years), 1), MAX_PROJECTION_YEARS);

	const monthlyRate = annualReturn.dividedBy(100).dividedBy(12);
	const totalMonths = years * 12;

	const points: ProjectionPoint[] = [];
	let balance = initial;
	let contributedToDate = ZERO;
	let contribution = baseContribution;

	points.push({
		monthIndex: 0,
		year: 0,
		nominal: balance,
		real: balance,
		contributedToDate
	});

	for (let month = 1; month <= totalMonths; month++) {
		// Contribution steps up on each anniversary, not every month.
		if (contributionGrowth.greaterThan(0) && month > 1 && (month - 1) % 12 === 0) {
			contribution = contribution.times(contributionGrowth.dividedBy(100).plus(1));
		}
		balance = balance.times(monthlyRate.plus(1)).plus(contribution);
		contributedToDate = contributedToDate.plus(contribution);

		const elapsedYears = new Decimal(month).dividedBy(12);
		const deflator = Decimal.pow(annualInflation.dividedBy(100).plus(1), elapsedYears);
		points.push({
			monthIndex: month,
			year: Number(elapsedYears.toFixed(4)),
			nominal: balance,
			real: deflator.isZero() ? balance : balance.dividedBy(deflator),
			contributedToDate
		});
	}

	const last = points[points.length - 1];
	return {
		points,
		endingNominal: last.nominal,
		endingReal: last.real,
		totalContributions: contributedToDate,
		growth: last.nominal.minus(initial).minus(contributedToDate),
		assumptions: {
			initialNetWorth: initial,
			monthlyContribution: baseContribution,
			annualReturnPercent: annualReturn,
			annualInflationPercent: annualInflation,
			contributionGrowthPercent: contributionGrowth,
			years
		}
	};
}

/** Every `every` months, for charting without carrying 600 points to the browser. */
export function sampleProjection(result: ProjectionResult, every = 3): ProjectionPoint[] {
	const sampled = result.points.filter((p) => p.monthIndex % every === 0);
	const last = result.points[result.points.length - 1];
	if (sampled[sampled.length - 1]?.monthIndex !== last.monthIndex) sampled.push(last);
	return sampled;
}

export interface Milestone {
	target: Decimal;
	/** Month the nominal path first reaches the target, or null within the horizon. */
	reachedInMonth: number | null;
	reachedInYear: number | null;
	calendarYear: number | null;
	ageAtMilestone: number | null;
	realValueThen: Decimal | null;
}

export function milestones(
	result: ProjectionResult,
	targets: readonly DecimalInput[],
	options: { startYear: number; birthYear?: number | null }
): Milestone[] {
	return targets.map((raw) => {
		const target = dec(raw);
		const hit = result.points.find((p) => p.nominal.greaterThanOrEqualTo(target));
		if (!hit) {
			return {
				target,
				reachedInMonth: null,
				reachedInYear: null,
				calendarYear: null,
				ageAtMilestone: null,
				realValueThen: null
			};
		}
		const yearsElapsed = Math.round(hit.monthIndex / 12);
		const calendarYear = options.startYear + yearsElapsed;
		return {
			target,
			reachedInMonth: hit.monthIndex,
			reachedInYear: yearsElapsed,
			calendarYear,
			ageAtMilestone: options.birthYear ? calendarYear - options.birthYear : null,
			realValueThen: hit.real
		};
	});
}

/** Default milestone ladder, scaled off the starting net worth. */
export function defaultMilestoneTargets(netWorth: Decimal): Decimal[] {
	const base = netWorth.lessThanOrEqualTo(0) ? new Decimal(1_000_000) : netWorth;
	return [2, 3, 5, 10].map((multiple) => {
		const raw = base.times(multiple);
		// Round to a readable figure: two significant digits.
		const magnitude = Decimal.pow(10, Math.max(0, raw.e - 1));
		return raw.dividedBy(magnitude).toDecimalPlaces(0, Decimal.ROUND_CEIL).times(magnitude);
	});
}
