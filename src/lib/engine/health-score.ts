import type { HealthBand } from '$lib/types/domain';
import { Decimal, ZERO } from './money';

/**
 * Financial health score.
 *
 * Six dimensions, each mapped linearly from a "bad" anchor to a "good" anchor and
 * clamped to 4–100. The anchors are stated thresholds, not a proprietary model:
 * the whole scale is visible here so a user can see why a score moved.
 *
 * A dimension with no data scores null and is left out of the composite instead of
 * dragging it down — an empty portfolio is not an unhealthy one.
 */

export interface ScoreDimension {
	id: string;
	label: string;
	/** 4–100, or null when the inputs do not support a score. */
	score: number | null;
	band: HealthBand | null;
	/** What the score was computed from, shown under the bar. */
	detail: string;
}

export interface HealthScoreResult {
	composite: number | null;
	band: HealthBand | null;
	dimensions: ScoreDimension[];
	/** Dimensions that had to be skipped for want of data. */
	skipped: string[];
}

/** Linear map from `bad` → 0 and `good` → 100, clamped to the 4–100 the bars draw. */
export function scoreBetween(value: Decimal, good: Decimal, bad: Decimal): number {
	if (good.equals(bad)) return 4;
	const raw = value.minus(bad).dividedBy(good.minus(bad)).times(100);
	const clamped = Decimal.min(Decimal.max(raw, 4), 100);
	return Math.round(clamped.toNumber());
}

export function bandOf(score: number): HealthBand {
	if (score >= 80) return 'Strong';
	if (score >= 60) return 'Adequate';
	if (score >= 40) return 'Watch';
	return 'Weak';
}

export interface HealthInputs {
	/** Months of expenses covered by liquid assets. */
	liquidityCover: Decimal | null;
	/** Target months from the user's settings; the score reaches 100 at 1.5×. */
	emergencyFundMonths: number;
	/** Total debt ÷ total assets, percent. */
	debtToAssets: Decimal | null;
	/** Net cash flow ÷ income, percent. */
	savingsRate: Decimal | null;
	/** HHI of the investment portfolio, 0–1. */
	concentrationHhi: Decimal | null;
	/** Largest single holding's share of the portfolio, percent. */
	topHoldingShare: Decimal | null;
	/** Net-worth change over the trailing window, percent. Null without history. */
	netWorthTrend: Decimal | null;
}

export function computeHealthScore(inputs: HealthInputs): HealthScoreResult {
	const dimensions: ScoreDimension[] = [];

	const push = (
		id: string,
		label: string,
		value: Decimal | null,
		good: Decimal,
		bad: Decimal,
		detail: (v: Decimal) => string
	) => {
		if (value === null) {
			dimensions.push({ id, label, score: null, band: null, detail: 'Not enough data yet' });
			return;
		}
		const score = scoreBetween(value, good, bad);
		dimensions.push({ id, label, score, band: bandOf(score), detail: detail(value) });
	};

	push(
		'trend',
		'Net worth trajectory',
		inputs.netWorthTrend,
		new Decimal(15),
		new Decimal(-10),
		(v) => `${v.toFixed(1)}% over the recorded window`
	);

	// 100 at 1.5× the user's own target, 0 at no cover at all.
	const coverTarget = new Decimal(inputs.emergencyFundMonths).times(1.5);
	push(
		'liquidity',
		'Liquidity cover',
		inputs.liquidityCover,
		coverTarget,
		ZERO,
		(v) => `${v.toFixed(1)} months of expenses`
	);

	push(
		'debt',
		'Debt load',
		inputs.debtToAssets,
		new Decimal(10),
		new Decimal(60),
		(v) => `${v.toFixed(1)}% of assets`
	);

	push(
		'savings',
		'Savings rate',
		inputs.savingsRate,
		new Decimal(30),
		ZERO,
		(v) => `${v.toFixed(1)}% of income`
	);

	push(
		'diversification',
		'Diversification',
		inputs.concentrationHhi,
		new Decimal('0.1'),
		new Decimal('0.4'),
		(v) => `HHI ${v.toFixed(2)}`
	);

	push(
		'concentration',
		'Concentration risk',
		inputs.topHoldingShare,
		new Decimal(15),
		new Decimal(60),
		(v) => `Top holding ${v.toFixed(1)}%`
	);

	const scored = dimensions.filter(
		(d): d is ScoreDimension & { score: number } => d.score !== null
	);
	const composite =
		scored.length === 0
			? null
			: Math.round(scored.reduce((acc, d) => acc + d.score, 0) / scored.length);

	return {
		composite,
		band: composite === null ? null : bandOf(composite),
		dimensions,
		skipped: dimensions.filter((d) => d.score === null).map((d) => d.label)
	};
}

/** The 20-segment meter on the dashboard. */
export function healthTicks(composite: number | null, segments = 20) {
	return Array.from({ length: segments }, (_, i) => {
		const threshold = (i * 100) / segments;
		const filled = composite !== null && threshold < composite;
		return {
			index: i,
			filled,
			// Ink for the first 60%, accent above it, matching the design's meter.
			color: filled
				? i < segments * 0.6
					? 'var(--color-text)'
					: 'var(--color-accent)'
				: 'var(--color-neutral-200)'
		};
	});
}
