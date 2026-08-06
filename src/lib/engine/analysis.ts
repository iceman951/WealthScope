import { isInvestmentType, sleeveOf, type Sleeve } from '$lib/types/domain';
import {
	allocationByAssetClass,
	allocationByCurrency,
	allocationByInstrument,
	concentration,
	liquidityLadder,
	type AllocationSlice,
	type ConcentrationResult,
	type LiquidityBandSlice
} from './allocation';
import { computeCashflow, emergencyCover, type CashflowResult } from './cashflow';
import type { RateTable } from './currency';
import { computeDebtMetrics, type DebtMetrics } from './debt';
import { computeHealthScore, type HealthScoreResult } from './health-score';
import { Decimal, ZERO, dec, divide } from './money';
import { computeNetWorth, type NetWorthResult } from './net-worth';
import { currencyExposure, runStressTests, type CurrencyExposure, type StressResult } from './risk';
import { portfolioReturn, sleeveWeights, type PortfolioReturn, type SleeveWeight } from './returns';
import type { AssetInput, CashflowInput, LiabilityInput, SnapshotInput } from './types';

/**
 * One deterministic pass over every record, producing the metrics the dashboard,
 * the analysis screens, the findings engine and the PDF report all read from.
 *
 * Pure: no database, no Svelte, no Cloudflare. Given the same inputs it produces
 * the same numbers, which is what makes it testable and what makes the server the
 * single source of truth for anything persisted.
 */

export interface AnalysisSettings {
	baseCurrency: string;
	emergencyFundMonths: number;
	/** Target sleeve weights, in percent. */
	sleeveTargets: Partial<Record<Sleeve, number>>;
}

export const DEFAULT_SLEEVE_TARGETS: Partial<Record<Sleeve, number>> = {
	Equities: 55,
	Bonds: 20,
	Commodities: 8,
	'Cash equivalents': 17
};

export interface AnalysisInputs {
	assets: readonly AssetInput[];
	liabilities: readonly LiabilityInput[];
	cashflow: readonly CashflowInput[];
	snapshots: readonly SnapshotInput[];
	rates: RateTable;
	settings: AnalysisSettings;
	asOf: string;
}

export interface AnalysisMetrics {
	asOf: string;
	baseCurrency: string;
	emergencyFundMonths: number;

	netWorth: NetWorthResult;
	cashflow: CashflowResult;
	debt: DebtMetrics;
	portfolio: PortfolioReturn;

	allocationByClass: AllocationSlice[];
	allocationByCurrency: AllocationSlice[];
	liquidity: LiquidityBandSlice[];
	balanceSheetConcentration: ConcentrationResult;
	portfolioConcentration: ConcentrationResult;
	currencyExposure: CurrencyExposure[];
	sleeves: SleeveWeight[];
	stress: StressResult[];

	liquidityCover: Decimal | null;
	/** Percentage change in net worth across the recorded snapshots. */
	netWorthTrend: Decimal | null;
	health: HealthScoreResult;

	recordCount: number;
	holdingCount: number;
	missingRates: string[];
	/** True when there is nothing to analyse — drives the zero-data onboarding state. */
	isEmpty: boolean;
}

export function analyse(inputs: AnalysisInputs): AnalysisMetrics {
	const { assets, liabilities, cashflow, snapshots, rates, settings, asOf } = inputs;
	const base = settings.baseCurrency;

	const netWorth = computeNetWorth(assets, liabilities, base, rates);
	const flow = computeCashflow(cashflow, base, rates, asOf);

	const investmentAssets = netWorth.assets.filter((a) => isInvestmentType(a.asset.assetType));
	const portfolio = portfolioReturn(investmentAssets);

	const allocationClass = allocationByAssetClass(netWorth.assets, netWorth.totalAssets);
	const allocationCurrency = allocationByCurrency(netWorth.assets, netWorth.totalAssets);
	const ladder = liquidityLadder(netWorth.assets, netWorth.totalAssets);

	const balanceSheetConcentration = concentration(
		allocationByInstrument(netWorth.assets, netWorth.totalAssets)
	);
	const portfolioConcentration = concentration(
		allocationByInstrument(investmentAssets, portfolio.marketValue)
	);

	const debt = computeDebtMetrics(netWorth.liabilities, netWorth.totalAssets, flow.monthlyIncome);
	const cover = emergencyCover(netWorth.liquidAssets, flow.monthlyExpenses);

	const sleeves = sleeveWeights(portfolio.holdings, settings.sleeveTargets);

	const equityExposure = investmentAssets
		.filter((a) => sleeveOf(a.asset.assetType) === 'Equities')
		.reduce<Decimal>((acc, a) => acc.plus(a.baseValue), ZERO);
	const bondExposure = investmentAssets
		.filter((a) => sleeveOf(a.asset.assetType) === 'Bonds')
		.reduce<Decimal>((acc, a) => acc.plus(a.baseValue), ZERO);
	const propertyExposure = netWorth.assets
		.filter((a) => a.asset.assetType === 'property')
		.reduce<Decimal>((acc, a) => acc.plus(a.baseValue), ZERO);

	const stress = runStressTests({
		equity: equityExposure,
		portfolio: portfolio.marketValue,
		bond: bondExposure,
		property: propertyExposure
	});

	const health = computeHealthScore({
		liquidityCover: cover,
		emergencyFundMonths: settings.emergencyFundMonths,
		debtToAssets: debt.debtToAssets,
		savingsRate: flow.savingsRate,
		concentrationHhi: portfolioConcentration.hhi,
		topHoldingShare: portfolioConcentration.top1Share,
		netWorthTrend: netWorthTrend(snapshots)
	});

	const missing = [...new Set([...netWorth.missingRates, ...flow.missingRates])].sort();

	return {
		asOf,
		baseCurrency: base,
		emergencyFundMonths: settings.emergencyFundMonths,
		netWorth,
		cashflow: flow,
		debt,
		portfolio,
		allocationByClass: allocationClass,
		allocationByCurrency: allocationCurrency,
		liquidity: ladder,
		balanceSheetConcentration,
		portfolioConcentration,
		currencyExposure: currencyExposure(netWorth.assets, netWorth.totalAssets),
		sleeves,
		stress,
		liquidityCover: cover,
		netWorthTrend: netWorthTrend(snapshots),
		health,
		recordCount: assets.length + liabilities.length + cashflow.length,
		holdingCount: assets.length,
		missingRates: missing,
		isEmpty: assets.length === 0 && liabilities.length === 0 && cashflow.length === 0
	};
}

/** Percentage change between the first and last recorded snapshot. */
export function netWorthTrend(snapshots: readonly SnapshotInput[]): Decimal | null {
	if (snapshots.length < 2) return null;
	const ordered = [...snapshots].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
	const first = dec(ordered[0].netWorth);
	const last = dec(ordered[ordered.length - 1].netWorth);
	if (first.isZero()) return null;
	// A move from a negative net worth to a less negative one is an improvement;
	// dividing by the signed start value would flip the sign, so use the magnitude.
	const change = divide(last.minus(first), first.abs());
	return change === null ? null : change.times(100);
}

/** Absolute net-worth change across the recorded snapshots, for the dashboard delta. */
export function netWorthDelta(snapshots: readonly SnapshotInput[]): Decimal | null {
	if (snapshots.length < 2) return null;
	const ordered = [...snapshots].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
	return dec(ordered[ordered.length - 1].netWorth).minus(dec(ordered[0].netWorth));
}
