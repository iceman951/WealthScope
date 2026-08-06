import { sleeveOf, type Sleeve } from '$lib/types/domain';
import { Decimal, ZERO, dec, divide } from './money';
import type { ConvertedAsset } from './net-worth';
import type { TransactionInput } from './types';

/**
 * Investment return metrics.
 *
 * Unrealised figures need only a cost basis. Realised gains need trade history, so
 * they are computed from transactions with FIFO lot matching. Anything the data
 * cannot support returns null and the screen shows an insufficient-data state —
 * an annualised return is never invented from an unknown holding period.
 */

export interface HoldingReturn {
	assetId: string;
	name: string;
	symbol: string | null;
	sleeve: Sleeve;
	marketValue: Decimal;
	costBasis: Decimal | null;
	unrealisedGain: Decimal | null;
	/** Percentage. Null when there is no cost basis to measure against. */
	unrealisedReturn: Decimal | null;
	weight: Decimal | null;
}

export function holdingReturns(
	assets: readonly ConvertedAsset[],
	portfolioValue: Decimal
): HoldingReturn[] {
	return assets.map((a) => {
		const cost = a.baseCost;
		const gain = cost === null ? null : a.baseValue.minus(cost);
		const pct = cost === null || cost.isZero() ? null : gain!.dividedBy(cost).times(100);
		return {
			assetId: a.asset.id,
			name: a.asset.name,
			symbol: a.asset.symbol,
			sleeve: sleeveOf(a.asset.assetType),
			marketValue: a.baseValue,
			costBasis: cost,
			unrealisedGain: gain,
			unrealisedReturn: pct,
			weight: portfolioValue.isZero() ? null : a.baseValue.dividedBy(portfolioValue).times(100)
		};
	});
}

export interface PortfolioReturn {
	marketValue: Decimal;
	costBasis: Decimal;
	/** True when at least one holding is missing a cost basis, so cost is partial. */
	costBasisIncomplete: boolean;
	unrealisedGain: Decimal;
	unrealisedReturn: Decimal | null;
	holdings: HoldingReturn[];
}

export function portfolioReturn(assets: readonly ConvertedAsset[]): PortfolioReturn {
	const marketValue = assets.reduce<Decimal>((acc, a) => acc.plus(a.baseValue), ZERO);
	const withCost = assets.filter((a) => a.baseCost !== null);
	const costBasis = withCost.reduce<Decimal>((acc, a) => acc.plus(a.baseCost!), ZERO);
	const gain = marketValue.minus(costBasis);

	return {
		marketValue,
		costBasis,
		costBasisIncomplete: withCost.length !== assets.length,
		unrealisedGain: gain,
		unrealisedReturn: costBasis.isZero() ? null : gain.dividedBy(costBasis).times(100),
		holdings: holdingReturns(assets, marketValue)
	};
}

interface Lot {
	quantity: Decimal;
	unitCost: Decimal;
}

export interface RealisedResult {
	realisedGain: Decimal;
	/** Sales that could not be matched to a purchase lot. */
	unmatchedSales: number;
	proceeds: Decimal;
	costOfSales: Decimal;
}

/**
 * FIFO realised gains from trade history. Fees and taxes on both sides reduce the
 * gain, which is the treatment a tax statement expects.
 */
export function realisedGains(transactions: readonly TransactionInput[]): RealisedResult {
	const lots = new Map<string, Lot[]>();
	let realisedGain = ZERO;
	let proceeds = ZERO;
	let costOfSales = ZERO;
	let unmatchedSales = 0;

	const ordered = [...transactions].sort((a, b) =>
		a.transactionDate === b.transactionDate
			? a.id.localeCompare(b.id)
			: a.transactionDate.localeCompare(b.transactionDate)
	);

	for (const tx of ordered) {
		const assetId = tx.assetId;
		if (!assetId) continue;
		const qty = dec(tx.quantity);
		const fees = dec(tx.feeAmount).plus(dec(tx.taxAmount));

		if (tx.transactionType === 'buy') {
			if (qty.isZero()) continue;
			// Acquisition cost includes the fees paid to acquire.
			const unitCost = dec(tx.grossAmount).plus(fees).dividedBy(qty);
			const list = lots.get(assetId) ?? [];
			list.push({ quantity: qty, unitCost });
			lots.set(assetId, list);
			continue;
		}

		if (tx.transactionType !== 'sell') continue;

		let remaining = qty;
		const netProceeds = dec(tx.grossAmount).minus(fees);
		proceeds = proceeds.plus(netProceeds);
		const list = lots.get(assetId) ?? [];
		let matchedCost = ZERO;
		let matchedQty = ZERO;

		while (remaining.greaterThan(0) && list.length > 0) {
			const lot = list[0];
			const take = Decimal.min(lot.quantity, remaining);
			matchedCost = matchedCost.plus(take.times(lot.unitCost));
			matchedQty = matchedQty.plus(take);
			lot.quantity = lot.quantity.minus(take);
			remaining = remaining.minus(take);
			if (lot.quantity.lessThanOrEqualTo(0)) list.shift();
		}
		lots.set(assetId, list);

		if (remaining.greaterThan(0)) unmatchedSales += 1;

		costOfSales = costOfSales.plus(matchedCost);
		realisedGain = realisedGain.plus(netProceeds).minus(matchedCost);
	}

	return { realisedGain, unmatchedSales, proceeds, costOfSales };
}

export interface IncomeResult {
	dividends: Decimal;
	interest: Decimal;
	fees: Decimal;
	taxes: Decimal;
	total: Decimal;
}

/** Dividend and interest income, net of the fees and taxes booked against it. */
export function investmentIncome(transactions: readonly TransactionInput[]): IncomeResult {
	let dividends = ZERO;
	let interest = ZERO;
	let fees = ZERO;
	let taxes = ZERO;

	for (const tx of transactions) {
		const amount = dec(tx.grossAmount);
		switch (tx.transactionType) {
			case 'dividend':
				dividends = dividends.plus(amount);
				break;
			case 'interest':
				interest = interest.plus(amount);
				break;
			case 'fee':
				fees = fees.plus(amount);
				break;
			case 'tax':
				taxes = taxes.plus(amount);
				break;
		}
	}

	return {
		dividends,
		interest,
		fees,
		taxes,
		total: dividends.plus(interest).minus(fees).minus(taxes)
	};
}

export interface TotalReturnResult {
	unrealised: Decimal;
	realised: Decimal;
	income: Decimal;
	total: Decimal;
	/** Percentage against cost basis, or null when there is no basis. */
	totalReturnPercent: Decimal | null;
}

export function totalReturn(
	portfolio: PortfolioReturn,
	realised: RealisedResult,
	income: IncomeResult
): TotalReturnResult {
	const total = portfolio.unrealisedGain.plus(realised.realisedGain).plus(income.total);
	return {
		unrealised: portfolio.unrealisedGain,
		realised: realised.realisedGain,
		income: income.total,
		total,
		totalReturnPercent: portfolio.costBasis.isZero()
			? null
			: total.dividedBy(portfolio.costBasis).times(100)
	};
}

/**
 * Compound annual growth rate.
 *
 * Returns null unless the maths is actually valid: a positive start value, a
 * positive end value, and a holding period of at least a month. A CAGR quoted
 * over an unknown or sub-monthly period is meaningless, so none is produced.
 */
export function annualisedReturn(
	startValue: Decimal,
	endValue: Decimal,
	startDate: string,
	endDate: string
): Decimal | null {
	if (startValue.lessThanOrEqualTo(0) || endValue.lessThanOrEqualTo(0)) return null;
	const days = daysBetween(startDate, endDate);
	if (days === null || days < 30) return null;
	const years = new Decimal(days).dividedBy(365.25);
	if (years.lessThanOrEqualTo(0)) return null;

	// (end / start)^(1/years) − 1
	const ratio = endValue.dividedBy(startValue);
	const growth = Decimal.pow(ratio, new Decimal(1).dividedBy(years));
	return growth.minus(1).times(100);
}

export function daysBetween(from: string, to: string): number | null {
	const a = Date.parse(`${from}T00:00:00Z`);
	const b = Date.parse(`${to}T00:00:00Z`);
	if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
	return Math.round((b - a) / 86_400_000);
}

export interface SleeveWeight {
	sleeve: Sleeve;
	actual: Decimal | null;
	target: Decimal | null;
	/** Percentage points of drift. Null when either side is unknown. */
	drift: Decimal | null;
}

/** Drift beyond this many percentage points raises a rebalance finding. */
export const REBALANCE_THRESHOLD_PP = new Decimal(5);

export function sleeveWeights(
	holdings: readonly HoldingReturn[],
	targets: Partial<Record<Sleeve, number>>
): SleeveWeight[] {
	const total = holdings.reduce<Decimal>((acc, h) => acc.plus(h.marketValue), ZERO);
	const bySleeve = new Map<Sleeve, Decimal>();
	for (const h of holdings) {
		bySleeve.set(h.sleeve, (bySleeve.get(h.sleeve) ?? ZERO).plus(h.marketValue));
	}

	const sleeves = new Set<Sleeve>([...bySleeve.keys(), ...(Object.keys(targets) as Sleeve[])]);

	return [...sleeves].map((sleeve) => {
		const value = bySleeve.get(sleeve) ?? ZERO;
		const actual = divide(value, total);
		const actualPct = actual === null ? null : actual.times(100);
		const targetRaw = targets[sleeve];
		const target = targetRaw === undefined ? null : new Decimal(targetRaw);
		return {
			sleeve,
			actual: actualPct,
			target,
			drift: actualPct === null || target === null ? null : actualPct.minus(target)
		};
	});
}
