import { describe, expect, it } from 'vitest';
import {
	bandOf,
	computeHealthScore,
	healthTicks,
	scoreBetween
} from '../../src/lib/engine/health-score';
import { Decimal } from '../../src/lib/engine/money';

const BASE = {
	liquidityCover: new Decimal(6),
	emergencyFundMonths: 6,
	debtToAssets: new Decimal(30),
	savingsRate: new Decimal(20),
	concentrationHhi: new Decimal('0.2'),
	topHoldingShare: new Decimal(30),
	netWorthTrend: new Decimal(8)
};

describe('scoreBetween', () => {
	it('maps the anchors to the ends of the scale', () => {
		expect(scoreBetween(new Decimal(10), new Decimal(10), new Decimal(0))).toBe(100);
		expect(scoreBetween(new Decimal(0), new Decimal(10), new Decimal(0))).toBe(4);
	});

	it('clamps beyond the anchors', () => {
		expect(scoreBetween(new Decimal(50), new Decimal(10), new Decimal(0))).toBe(100);
		expect(scoreBetween(new Decimal(-50), new Decimal(10), new Decimal(0))).toBe(4);
	});

	it('handles an inverted scale, where lower is better', () => {
		// Debt-to-assets: 10% is good, 60% is bad.
		expect(scoreBetween(new Decimal(10), new Decimal(10), new Decimal(60))).toBe(100);
		expect(scoreBetween(new Decimal(60), new Decimal(10), new Decimal(60))).toBe(4);
	});

	it('does not divide by zero when the anchors coincide', () => {
		expect(scoreBetween(new Decimal(5), new Decimal(5), new Decimal(5))).toBe(4);
	});
});

describe('bandOf', () => {
	it('names each band at its boundary', () => {
		expect(bandOf(80)).toBe('Strong');
		expect(bandOf(60)).toBe('Adequate');
		expect(bandOf(40)).toBe('Watch');
		expect(bandOf(39)).toBe('Weak');
	});
});

describe('computeHealthScore', () => {
	it('scores every dimension when the data supports it', () => {
		const result = computeHealthScore(BASE);
		expect(result.dimensions).toHaveLength(6);
		expect(result.dimensions.every((d) => d.score !== null)).toBe(true);
		expect(result.composite).not.toBeNull();
		expect(result.skipped).toEqual([]);
	});

	it('skips a dimension with no data rather than scoring it zero', () => {
		const result = computeHealthScore({ ...BASE, netWorthTrend: null, liquidityCover: null });
		const trend = result.dimensions.find((d) => d.id === 'trend')!;
		expect(trend.score).toBeNull();
		expect(trend.detail).toBe('Not enough data yet');
		expect(result.skipped).toContain('Net worth trajectory');
	});

	it('returns a null composite when nothing can be scored — an empty account is not unhealthy', () => {
		const result = computeHealthScore({
			liquidityCover: null,
			emergencyFundMonths: 6,
			debtToAssets: null,
			savingsRate: null,
			concentrationHhi: null,
			topHoldingShare: null,
			netWorthTrend: null
		});
		expect(result.composite).toBeNull();
		expect(result.band).toBeNull();
	});

	it('grades liquidity against the user’s own target', () => {
		const strict = computeHealthScore({ ...BASE, emergencyFundMonths: 12 });
		const relaxed = computeHealthScore({ ...BASE, emergencyFundMonths: 3 });
		const strictScore = strict.dimensions.find((d) => d.id === 'liquidity')!.score!;
		const relaxedScore = relaxed.dimensions.find((d) => d.id === 'liquidity')!.score!;
		expect(relaxedScore).toBeGreaterThan(strictScore);
	});

	it('scores a healthier balance sheet higher', () => {
		const worse = computeHealthScore({
			...BASE,
			debtToAssets: new Decimal(55),
			savingsRate: new Decimal(2)
		});
		expect(computeHealthScore(BASE).composite!).toBeGreaterThan(worse.composite!);
	});
});

describe('healthTicks', () => {
	it('fills segments in proportion to the score', () => {
		expect(healthTicks(50).filter((t) => t.filled)).toHaveLength(10);
		expect(healthTicks(0).filter((t) => t.filled)).toHaveLength(0);
		expect(healthTicks(100).filter((t) => t.filled)).toHaveLength(20);
	});

	it('fills nothing when there is no score', () => {
		expect(healthTicks(null).every((t) => !t.filled)).toBe(true);
	});
});
