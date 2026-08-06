import { isInvestmentType, liquidityOf, type LiquidityBand } from '$lib/types/domain';
import { convert, type RateTable } from './currency';
import { Decimal, ZERO, dec } from './money';
import type { AssetInput, LiabilityInput } from './types';

/**
 * Net worth = converted assets − converted liabilities.
 *
 * Any row whose currency cannot be resolved to the base currency is excluded from
 * the total and listed in `missingRates`, so the UI shows "incomplete" rather than
 * a total that quietly omits a holding.
 */

/** quantity × unitPrice, unless a manual valuation overrides it. */
export function assetNativeValue(
	asset: Pick<AssetInput, 'quantity' | 'unitPrice' | 'manualValue'>
): Decimal {
	if (asset.manualValue !== null && asset.manualValue !== undefined && asset.manualValue !== '') {
		return dec(asset.manualValue);
	}
	return dec(asset.quantity).times(dec(asset.unitPrice));
}

export function assetLiquidity(asset: AssetInput): LiquidityBand {
	return liquidityOf(asset.assetType, asset.accountType);
}

export interface ConvertedAsset {
	asset: AssetInput;
	nativeValue: Decimal;
	baseValue: Decimal;
	liquidity: LiquidityBand;
	/** Cost basis in the base currency, when one is recorded. */
	baseCost: Decimal | null;
}

export interface ConvertedLiability {
	liability: LiabilityInput;
	baseBalance: Decimal;
	baseMonthlyPayment: Decimal;
}

export interface NetWorthResult {
	totalAssets: Decimal;
	totalLiabilities: Decimal;
	netWorth: Decimal;
	liquidAssets: Decimal;
	investmentAssets: Decimal;
	/** Assets successfully converted, in input order. */
	assets: ConvertedAsset[];
	liabilities: ConvertedLiability[];
	missingRates: string[];
	appliedRates: Record<string, string>;
}

export function computeNetWorth(
	assets: readonly AssetInput[],
	liabilities: readonly LiabilityInput[],
	baseCurrency: string,
	rates: RateTable
): NetWorthResult {
	const missing = new Set<string>();
	const applied: Record<string, string> = {};
	const convertedAssets: ConvertedAsset[] = [];
	const convertedLiabilities: ConvertedLiability[] = [];

	let totalAssets = ZERO;
	let liquidAssets = ZERO;
	let investmentAssets = ZERO;

	for (const asset of assets) {
		const nativeValue = assetNativeValue(asset);
		const result = convert(nativeValue, asset.currency, baseCurrency, rates);
		if (!result.ok) {
			missing.add(result.missing);
			continue;
		}
		if (asset.currency.toUpperCase() !== baseCurrency.toUpperCase()) {
			applied[`${asset.currency.toUpperCase()}/${baseCurrency.toUpperCase()}`] =
				result.rate.toString();
		}

		const liquidity = assetLiquidity(asset);
		const cost =
			asset.acquisitionCost === null || asset.acquisitionCost === ''
				? null
				: dec(asset.acquisitionCost).times(result.rate);

		convertedAssets.push({
			asset,
			nativeValue,
			baseValue: result.value,
			liquidity,
			baseCost: cost
		});

		totalAssets = totalAssets.plus(result.value);
		if (liquidity === 'Liquid') liquidAssets = liquidAssets.plus(result.value);
		if (isInvestmentType(asset.assetType)) {
			investmentAssets = investmentAssets.plus(result.value);
		}
	}

	let totalLiabilities = ZERO;
	for (const liability of liabilities) {
		const result = convert(liability.outstandingBalance, liability.currency, baseCurrency, rates);
		if (!result.ok) {
			missing.add(result.missing);
			continue;
		}
		if (liability.currency.toUpperCase() !== baseCurrency.toUpperCase()) {
			applied[`${liability.currency.toUpperCase()}/${baseCurrency.toUpperCase()}`] =
				result.rate.toString();
		}
		const payment = dec(liability.monthlyPayment ?? liability.minimumPayment ?? 0).times(
			result.rate
		);
		convertedLiabilities.push({
			liability,
			baseBalance: result.value,
			baseMonthlyPayment: payment
		});
		totalLiabilities = totalLiabilities.plus(result.value);
	}

	return {
		totalAssets,
		totalLiabilities,
		netWorth: totalAssets.minus(totalLiabilities),
		liquidAssets,
		investmentAssets,
		assets: convertedAssets,
		liabilities: convertedLiabilities,
		missingRates: [...missing].sort(),
		appliedRates: applied
	};
}
