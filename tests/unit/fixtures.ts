import { buildRateTable } from '../../src/lib/engine/currency';
import type {
	AssetInput,
	CashflowInput,
	LiabilityInput,
	SnapshotInput,
	TransactionInput
} from '../../src/lib/engine/types';

/** Shared, deliberately fictional fixtures for the engine tests. */

export const RATES = buildRateTable([
	{ baseCurrency: 'USD', quoteCurrency: 'THB', rate: '36.5', rateDate: '2026-08-01' }
]);

export const EMPTY_RATES = buildRateTable([]);

export function asset(overrides: Partial<AssetInput> = {}): AssetInput {
	return {
		id: 'a1',
		name: 'Test asset',
		assetType: 'cash',
		symbol: null,
		currency: 'THB',
		quantity: '1',
		unitPrice: '1000',
		manualValue: null,
		acquisitionCost: null,
		valuationDate: '2026-08-01',
		accountId: null,
		accountName: null,
		accountType: 'bank',
		...overrides
	};
}

export function liability(overrides: Partial<LiabilityInput> = {}): LiabilityInput {
	return {
		id: 'l1',
		name: 'Test loan',
		liabilityType: 'mortgage',
		currency: 'THB',
		originalPrincipal: '1000000',
		outstandingBalance: '800000',
		interestRate: '3.4',
		minimumPayment: null,
		monthlyPayment: '6000',
		startDate: '2020-01-01',
		maturityDate: '2045-01-01',
		...overrides
	};
}

export function cashflow(overrides: Partial<CashflowInput> = {}): CashflowInput {
	return {
		id: 'c1',
		entryType: 'income',
		category: 'salary',
		name: 'Salary',
		amount: '100000',
		currency: 'THB',
		frequency: 'monthly',
		entryDate: '2024-01-01',
		endDate: null,
		isRecurring: true,
		notes: null,
		...overrides
	};
}

export function transaction(overrides: Partial<TransactionInput> = {}): TransactionInput {
	return {
		id: 't1',
		assetId: 'a1',
		transactionType: 'buy',
		transactionDate: '2025-01-15',
		quantity: '10',
		unitPrice: '100',
		grossAmount: '1000',
		feeAmount: '0',
		taxAmount: '0',
		currency: 'THB',
		exchangeRate: null,
		...overrides
	};
}

export function snapshot(overrides: Partial<SnapshotInput> = {}): SnapshotInput {
	return {
		snapshotDate: '2026-01-01',
		baseCurrency: 'THB',
		totalAssets: '1000000',
		totalLiabilities: '400000',
		netWorth: '600000',
		...overrides
	};
}

export function prices(start: number, count: number, drift = 0.01) {
	return Array.from({ length: count }, (_, i) => {
		const value = start * Math.pow(1 + drift, i) * (1 + Math.sin(i) * 0.02);
		return {
			priceDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-01`.replace(
				'2024',
				String(2024 + Math.floor(i / 12))
			),
			price: value.toFixed(8),
			currency: 'USD'
		};
	});
}
