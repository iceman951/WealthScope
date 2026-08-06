import { toCsv, type CsvColumn } from '$lib/exporters/csv';
import {
	ASSET_TYPE_LABELS,
	LIABILITY_TYPE_LABELS,
	type AssetType,
	type LiabilityType
} from '$lib/types/domain';
import { listAssets } from '../repositories/assets';
import { listCashflowEntries } from '../repositories/cashflow';
import { listLiabilities } from '../repositories/liabilities';
import { listTransactions } from '../repositories/transactions';
import { listSnapshots } from '../repositories/snapshots';

/**
 * CSV export.
 *
 * Column names mirror the import templates so a round trip is lossless, and
 * values are written at full stored precision — an export is a backup, not a
 * report. Every query is scoped to the authenticated user.
 */

export type ExportKind = 'assets' | 'liabilities' | 'cashflow' | 'transactions' | 'snapshots';

export const EXPORT_KINDS: { kind: ExportKind; label: string; description: string }[] = [
	{
		kind: 'assets',
		label: 'Assets',
		description: 'Every asset with its quantity, price and cost.'
	},
	{
		kind: 'liabilities',
		label: 'Liabilities',
		description: 'Balances, rates, payments and maturity dates.'
	},
	{
		kind: 'cashflow',
		label: 'Income & expenses',
		description: 'Recurring and one-off entries with their frequency.'
	},
	{
		kind: 'transactions',
		label: 'Transactions',
		description: 'Buys, sells, dividends, interest, fees and taxes.'
	},
	{
		kind: 'snapshots',
		label: 'Snapshots',
		description: 'Recorded net-worth history, one row per analysis run.'
	}
];

export async function buildCsv(userId: string, kind: ExportKind): Promise<string> {
	switch (kind) {
		case 'assets': {
			const rows = await listAssets(userId);
			const columns: CsvColumn<(typeof rows)[number]>[] = [
				{ header: 'name', value: (r) => r.name },
				{ header: 'asset_type', value: (r) => r.assetType },
				{ header: 'asset_class_label', value: (r) => ASSET_TYPE_LABELS[r.assetType as AssetType] },
				{ header: 'symbol', value: (r) => r.symbol },
				{ header: 'currency', value: (r) => r.currency },
				{ header: 'quantity', value: (r) => r.quantity },
				{ header: 'unit_price', value: (r) => r.unitPrice },
				{ header: 'value', value: (r) => r.manualValue },
				{ header: 'cost', value: (r) => r.acquisitionCost },
				{ header: 'valuation_date', value: (r) => r.valuationDate },
				{ header: 'account', value: (r) => r.accountName },
				{ header: 'notes', value: (r) => r.notes }
			];
			return toCsv(rows, columns);
		}

		case 'liabilities': {
			const rows = await listLiabilities(userId);
			return toCsv(rows, [
				{ header: 'name', value: (r) => r.name },
				{ header: 'liability_type', value: (r) => r.liabilityType },
				{
					header: 'liability_type_label',
					value: (r) => LIABILITY_TYPE_LABELS[r.liabilityType as LiabilityType]
				},
				{ header: 'currency', value: (r) => r.currency },
				{ header: 'original_principal', value: (r) => r.originalPrincipal },
				{ header: 'outstanding_balance', value: (r) => r.outstandingBalance },
				{ header: 'interest_rate', value: (r) => r.interestRate },
				{ header: 'minimum_payment', value: (r) => r.minimumPayment },
				{ header: 'monthly_payment', value: (r) => r.monthlyPayment },
				{ header: 'start_date', value: (r) => r.startDate },
				{ header: 'maturity_date', value: (r) => r.maturityDate },
				{ header: 'notes', value: (r) => r.notes }
			]);
		}

		case 'cashflow': {
			const rows = await listCashflowEntries(userId);
			return toCsv(rows, [
				{ header: 'entry_type', value: (r) => r.entryType },
				{ header: 'category', value: (r) => r.category },
				{ header: 'name', value: (r) => r.name },
				{ header: 'amount', value: (r) => r.amount },
				{ header: 'currency', value: (r) => r.currency },
				{ header: 'frequency', value: (r) => r.frequency },
				{ header: 'entry_date', value: (r) => r.entryDate },
				{ header: 'end_date', value: (r) => r.endDate },
				{ header: 'is_recurring', value: (r) => (r.isRecurring ? 'true' : 'false') },
				{ header: 'notes', value: (r) => r.notes }
			]);
		}

		case 'transactions': {
			const rows = await listTransactions(userId);
			return toCsv(rows, [
				{ header: 'account', value: (r) => r.accountName },
				{ header: 'symbol', value: (r) => r.assetSymbol },
				{ header: 'holding', value: (r) => r.assetName },
				{ header: 'transaction_type', value: (r) => r.transactionType },
				{ header: 'transaction_date', value: (r) => r.transactionDate },
				{ header: 'quantity', value: (r) => r.quantity },
				{ header: 'unit_price', value: (r) => r.unitPrice },
				{ header: 'gross_amount', value: (r) => r.grossAmount },
				{ header: 'fee_amount', value: (r) => r.feeAmount },
				{ header: 'tax_amount', value: (r) => r.taxAmount },
				{ header: 'currency', value: (r) => r.currency },
				{ header: 'exchange_rate', value: (r) => r.exchangeRate },
				{ header: 'notes', value: (r) => r.notes }
			]);
		}

		case 'snapshots': {
			const rows = await listSnapshots(userId);
			return toCsv(rows, [
				{ header: 'snapshot_date', value: (r) => r.snapshotDate },
				{ header: 'base_currency', value: (r) => r.baseCurrency },
				{ header: 'total_assets', value: (r) => r.totalAssets },
				{ header: 'total_liabilities', value: (r) => r.totalLiabilities },
				{ header: 'net_worth', value: (r) => r.netWorth },
				{ header: 'liquid_assets', value: (r) => r.liquidAssets },
				{ header: 'investment_assets', value: (r) => r.investmentAssets }
			]);
		}
	}
}

export function exportFilename(kind: ExportKind, asOf: string): string {
	return `wealthscope-${kind}-${asOf}.csv`;
}
