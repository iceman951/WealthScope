import { describe, expect, it } from 'vitest';
import {
	MAX_PROJECTION_YEARS,
	defaultMilestoneTargets,
	milestones,
	project,
	sampleProjection
} from '../../src/lib/engine/projection';
import { Decimal } from '../../src/lib/engine/money';

describe('project', () => {
	it('is deterministic — the same inputs always give the same series', () => {
		const inputs = {
			initialNetWorth: '1000000',
			monthlyContribution: '10000',
			annualReturnPercent: '6',
			annualInflationPercent: '2.2',
			years: 10
		};
		expect(project(inputs).endingNominal.toString()).toBe(project(inputs).endingNominal.toString());
	});

	it('starts at the initial net worth', () => {
		const result = project({
			initialNetWorth: '500000',
			monthlyContribution: '0',
			annualReturnPercent: '0',
			annualInflationPercent: '0',
			years: 5
		});
		expect(result.points[0].nominal.toString()).toBe('500000');
	});

	it('with no return, ending value is start plus contributions', () => {
		const result = project({
			initialNetWorth: '100000',
			monthlyContribution: '1000',
			annualReturnPercent: '0',
			annualInflationPercent: '0',
			years: 1
		});
		expect(result.endingNominal.toString()).toBe('112000');
		expect(result.totalContributions.toString()).toBe('12000');
		expect(result.growth.toString()).toBe('0');
	});

	it('compounds monthly', () => {
		const result = project({
			initialNetWorth: '1000',
			monthlyContribution: '0',
			annualReturnPercent: '12',
			annualInflationPercent: '0',
			years: 1
		});
		// 1000 × (1 + 0.01)^12 = 1126.825…
		expect(Number(result.endingNominal.toString())).toBeCloseTo(1126.825, 2);
	});

	it('deflates the real path by inflation', () => {
		const result = project({
			initialNetWorth: '1000',
			monthlyContribution: '0',
			annualReturnPercent: '10',
			annualInflationPercent: '10',
			years: 5
		});
		// A 10% nominal rate compounded monthly is ~10.47% effective, so the real
		// value drifts slightly above flat rather than staying exactly at 1000.
		const real = Number(result.endingReal.toString());
		expect(real).toBeGreaterThan(1000);
		expect(real).toBeLessThan(1050);
	});

	it('grows the contribution on each anniversary when asked', () => {
		const flat = project({
			initialNetWorth: '0',
			monthlyContribution: '1000',
			annualReturnPercent: '0',
			annualInflationPercent: '0',
			years: 3
		});
		const growing = project({
			initialNetWorth: '0',
			monthlyContribution: '1000',
			annualReturnPercent: '0',
			annualInflationPercent: '0',
			contributionGrowthPercent: '10',
			years: 3
		});
		expect(growing.totalContributions.greaterThan(flat.totalContributions)).toBe(true);
	});

	it('handles a negative starting net worth', () => {
		const result = project({
			initialNetWorth: '-200000',
			monthlyContribution: '20000',
			annualReturnPercent: '5',
			annualInflationPercent: '2',
			years: 3
		});
		expect(result.points[0].nominal.toString()).toBe('-200000');
		expect(result.endingNominal.greaterThan(0)).toBe(true);
	});

	it('clamps the horizon to the supported range', () => {
		expect(
			project({
				initialNetWorth: '0',
				monthlyContribution: '0',
				annualReturnPercent: '0',
				annualInflationPercent: '0',
				years: 500
			}).assumptions.years
		).toBe(MAX_PROJECTION_YEARS);
		expect(
			project({
				initialNetWorth: '0',
				monthlyContribution: '0',
				annualReturnPercent: '0',
				annualInflationPercent: '0',
				years: 0
			}).assumptions.years
		).toBe(1);
	});

	it('produces one point per month plus month zero', () => {
		const result = project({
			initialNetWorth: '0',
			monthlyContribution: '0',
			annualReturnPercent: '0',
			annualInflationPercent: '0',
			years: 2
		});
		expect(result.points).toHaveLength(25);
	});
});

describe('sampleProjection', () => {
	it('thins the series but always keeps the final point', () => {
		const result = project({
			initialNetWorth: '1000',
			monthlyContribution: '10',
			annualReturnPercent: '5',
			annualInflationPercent: '2',
			years: 10
		});
		const sampled = sampleProjection(result, 3);
		expect(sampled.length).toBeLessThan(result.points.length);
		expect(sampled[sampled.length - 1].monthIndex).toBe(120);
	});
});

describe('milestones', () => {
	const result = project({
		initialNetWorth: '1000000',
		monthlyContribution: '20000',
		annualReturnPercent: '6',
		annualInflationPercent: '2',
		years: 20
	});

	it('reports the year and age a target is reached', () => {
		const found = milestones(result, ['2000000'], { startYear: 2026, birthYear: 1988 });
		expect(found[0].reachedInMonth).not.toBeNull();
		expect(found[0].calendarYear).toBeGreaterThan(2026);
		expect(found[0].ageAtMilestone).toBe(found[0].calendarYear! - 1988);
	});

	it('reports nulls for a target beyond the horizon', () => {
		const found = milestones(result, ['999999999'], { startYear: 2026, birthYear: 1988 });
		expect(found[0].reachedInMonth).toBeNull();
		expect(found[0].realValueThen).toBeNull();
	});

	it('leaves the age null when no birth year is known', () => {
		const found = milestones(result, ['2000000'], { startYear: 2026, birthYear: null });
		expect(found[0].ageAtMilestone).toBeNull();
	});
});

describe('defaultMilestoneTargets', () => {
	it('produces four rising, readable targets', () => {
		const targets = defaultMilestoneTargets(new Decimal(1_234_567));
		expect(targets).toHaveLength(4);
		for (let i = 1; i < targets.length; i++) {
			expect(targets[i].greaterThan(targets[i - 1])).toBe(true);
		}
	});

	it('falls back to a sensible ladder from zero', () => {
		const targets = defaultMilestoneTargets(new Decimal(0));
		expect(targets[0].greaterThan(0)).toBe(true);
	});
});
