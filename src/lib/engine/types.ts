import type {
	AccountType,
	AssetType,
	CashflowCategory,
	CashflowEntryType,
	Frequency,
	LiabilityType,
	LiquidityBand,
	TransactionType
} from '$lib/types/domain';

/**
 * Plain inputs the engine accepts. Deliberately not the Drizzle row types: the
 * engine has no database import, so it can be unit-tested with literals and
 * reused by a worker or a report generator without dragging a driver along.
 *
 * Every numeric field is the exact string PostgreSQL returned.
 */

export interface AssetInput {
	id: string;
	name: string;
	assetType: AssetType;
	symbol: string | null;
	currency: string;
	quantity: string;
	unitPrice: string;
	manualValue: string | null;
	acquisitionCost: string | null;
	valuationDate: string;
	accountId: string | null;
	accountName: string | null;
	accountType: AccountType | null;
}

export interface LiabilityInput {
	id: string;
	name: string;
	liabilityType: LiabilityType;
	currency: string;
	originalPrincipal: string;
	outstandingBalance: string;
	interestRate: string;
	minimumPayment: string | null;
	monthlyPayment: string | null;
	startDate: string | null;
	maturityDate: string | null;
}

export interface CashflowInput {
	id: string;
	entryType: CashflowEntryType;
	category: CashflowCategory;
	name: string;
	amount: string;
	currency: string;
	frequency: Frequency;
	entryDate: string;
	endDate: string | null;
	isRecurring: boolean;
	notes: string | null;
}

export interface TransactionInput {
	id: string;
	assetId: string | null;
	transactionType: TransactionType;
	transactionDate: string;
	quantity: string | null;
	unitPrice: string | null;
	grossAmount: string;
	feeAmount: string;
	taxAmount: string;
	currency: string;
	exchangeRate: string | null;
}

export interface PricePoint {
	priceDate: string;
	price: string;
	currency: string;
}

export interface SnapshotInput {
	snapshotDate: string;
	baseCurrency: string;
	totalAssets: string;
	totalLiabilities: string;
	netWorth: string;
}

/** A valued asset carries its own currency alongside the amount it resolved to. */
export interface ValuedAsset {
	asset: AssetInput;
	/** quantity × unitPrice, or manualValue when set. In the asset's own currency. */
	nativeValue: string;
	liquidity: LiquidityBand;
}

export interface EngineContext {
	baseCurrency: string;
	/** ISO date the calculation is anchored to. Injected so results are testable. */
	asOf: string;
}
