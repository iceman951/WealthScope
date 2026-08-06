import {
	ASSET_TYPE_LABELS,
	LIQUIDITY_BANDS,
	LIQUIDITY_NOTES,
	type AssetType,
	type LiquidityBand
} from '$lib/types/domain';
import { Decimal, ZERO, divide, percentOf } from './money';
import type { ConvertedAsset } from './net-worth';

/**
 * Allocation and concentration.
 *
 * Shares are computed against the converted asset total, so a portfolio spread
 * across currencies still sums to 100%. When the total is zero every share is
 * null — an empty portfolio has no allocation, not a zero one.
 */

export interface AllocationSlice {
	key: string;
	label: string;
	value: Decimal;
	/** Percentage of the total, or null when the total is zero. */
	share: Decimal | null;
}

function buildSlices(
	groups: Map<string, { label: string; value: Decimal }>,
	total: Decimal,
	order?: readonly string[]
): AllocationSlice[] {
	const slices = [...groups.entries()].map(([key, g]) => ({
		key,
		label: g.label,
		value: g.value,
		share: percentOf(g.value, total)
	}));

	if (order) {
		const rank = new Map(order.map((k, i) => [k, i]));
		slices.sort((a, b) => (rank.get(a.key) ?? 999) - (rank.get(b.key) ?? 999));
	} else {
		slices.sort((a, b) => b.value.comparedTo(a.value));
	}
	return slices;
}

/**
 * Class order used by the dashboard's allocation bar. Largest household holdings
 * first, matching the reading order in the design.
 */
export const ASSET_CLASS_ORDER: readonly AssetType[] = [
	'property',
	'stock',
	'etf',
	'fund',
	'bond',
	'cash',
	'crypto',
	'business',
	'vehicle',
	'collectible',
	'other'
];

/**
 * Ten steps drawn from the Modernist ramps. Adjacent classes never share a step,
 * and the sequence alternates ink and accent so the bar reads without colour.
 */
export const ALLOCATION_COLORS: Record<AssetType, string> = {
	property: 'var(--color-accent)',
	stock: 'var(--color-neutral-900)',
	etf: 'var(--color-neutral-700)',
	fund: 'var(--color-accent-400)',
	bond: 'var(--color-neutral-400)',
	cash: 'var(--color-neutral-500)',
	crypto: 'var(--color-accent-300)',
	business: 'var(--color-accent-600)',
	vehicle: 'var(--color-neutral-300)',
	collectible: 'var(--color-accent-200)',
	other: 'var(--color-neutral-200)'
};

export function allocationByAssetClass(assets: readonly ConvertedAsset[], total: Decimal) {
	const groups = new Map<string, { label: string; value: Decimal }>();
	for (const a of assets) {
		const key = a.asset.assetType;
		const current = groups.get(key) ?? { label: ASSET_TYPE_LABELS[key], value: ZERO };
		groups.set(key, { label: current.label, value: current.value.plus(a.baseValue) });
	}
	return buildSlices(groups, total, ASSET_CLASS_ORDER);
}

export function allocationByAccount(assets: readonly ConvertedAsset[], total: Decimal) {
	const groups = new Map<string, { label: string; value: Decimal }>();
	for (const a of assets) {
		const key = a.asset.accountId ?? 'unassigned';
		const label = a.asset.accountName ?? 'Not in an account';
		const current = groups.get(key) ?? { label, value: ZERO };
		groups.set(key, { label: current.label, value: current.value.plus(a.baseValue) });
	}
	return buildSlices(groups, total);
}

export function allocationByCurrency(assets: readonly ConvertedAsset[], total: Decimal) {
	const groups = new Map<string, { label: string; value: Decimal }>();
	for (const a of assets) {
		const key = a.asset.currency.toUpperCase();
		const current = groups.get(key) ?? { label: key, value: ZERO };
		groups.set(key, { label: current.label, value: current.value.plus(a.baseValue) });
	}
	return buildSlices(groups, total);
}

export function allocationByInstrument(assets: readonly ConvertedAsset[], total: Decimal) {
	const groups = new Map<string, { label: string; value: Decimal }>();
	for (const a of assets) {
		const key = a.asset.id;
		const label = a.asset.symbol ? `${a.asset.symbol} — ${a.asset.name}` : a.asset.name;
		const current = groups.get(key) ?? { label, value: ZERO };
		groups.set(key, { label: current.label, value: current.value.plus(a.baseValue) });
	}
	return buildSlices(groups, total);
}

export interface LiquidityBandSlice extends AllocationSlice {
	band: LiquidityBand;
	note: string;
	color: string;
}

const LIQUIDITY_COLORS: Record<LiquidityBand, string> = {
	Liquid: 'var(--color-accent)',
	'Semi-liquid': 'var(--color-neutral-700)',
	Illiquid: 'var(--color-neutral-400)'
};

export function liquidityLadder(
	assets: readonly ConvertedAsset[],
	total: Decimal
): LiquidityBandSlice[] {
	return LIQUIDITY_BANDS.map((band) => {
		const value = assets
			.filter((a) => a.liquidity === band)
			.reduce<Decimal>((acc, a) => acc.plus(a.baseValue), ZERO);
		return {
			key: band,
			band,
			label: band,
			note: LIQUIDITY_NOTES[band],
			color: LIQUIDITY_COLORS[band],
			value,
			share: percentOf(value, total)
		};
	});
}

export interface ConcentrationResult {
	/** Herfindahl–Hirschman index on weights expressed as fractions, so 0–1. */
	hhi: Decimal | null;
	/** 1 / HHI — how many equally sized holdings the portfolio behaves like. */
	effectiveHoldings: Decimal | null;
	top1Share: Decimal | null;
	top3Share: Decimal | null;
	/** Holdings ordered by weight, with a running cumulative share. */
	positions: { key: string; label: string; value: Decimal; share: Decimal; cumulative: Decimal }[];
}

/**
 * Concentration over an arbitrary set of positions. Used twice: once across the
 * whole balance sheet and once inside the investment portfolio, which is why it
 * takes slices rather than assets.
 */
export function concentration(slices: readonly AllocationSlice[]): ConcentrationResult {
	const total = slices.reduce<Decimal>((acc, s) => acc.plus(s.value), ZERO);
	if (total.isZero() || slices.length === 0) {
		return { hhi: null, effectiveHoldings: null, top1Share: null, top3Share: null, positions: [] };
	}

	const ordered = [...slices].sort((a, b) => b.value.comparedTo(a.value));
	let hhi = ZERO;
	let cumulative = ZERO;
	const positions = ordered.map((s) => {
		const fraction = s.value.dividedBy(total);
		hhi = hhi.plus(fraction.times(fraction));
		const share = fraction.times(100);
		cumulative = cumulative.plus(share);
		return { key: s.key, label: s.label, value: s.value, share, cumulative };
	});

	const top1 = positions[0]?.share ?? ZERO;
	const top3 = positions.slice(0, 3).reduce<Decimal>((acc, p) => acc.plus(p.share), ZERO);

	return {
		hhi,
		effectiveHoldings: divide(1, hhi),
		top1Share: top1,
		top3Share: top3,
		positions
	};
}
