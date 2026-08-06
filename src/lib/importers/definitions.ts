import { z } from 'zod';
import {
	ASSET_TYPES,
	ASSET_TYPE_LABELS,
	CASHFLOW_CATEGORIES,
	CASHFLOW_CATEGORY_LABELS,
	CASHFLOW_ENTRY_TYPES,
	FREQUENCIES,
	LIABILITY_TYPES,
	LIABILITY_TYPE_LABELS,
	TRANSACTION_TYPES,
	type ImportKind
} from '$lib/types/domain';
import {
	currencyCodeSchema,
	enumOf,
	isoDateSchema,
	moneySchema,
	nameSchema,
	optionalDateSchema,
	optionalMoneySchema,
	optionalQuantitySchema,
	percentSchema,
	quantitySchema,
	symbolSchema
} from '$lib/schemas/common';

/**
 * What each import kind expects, and how a CSV column is guessed onto it.
 *
 * Guessing only ever pre-fills the mapping step — the user always confirms it
 * before a single row is written.
 */

export interface ImportField {
	key: string;
	label: string;
	required: boolean;
	/** Lower-case header fragments that suggest this field. */
	aliases: string[];
	hint?: string;
}

export interface ImportDefinition {
	kind: ImportKind;
	label: string;
	description: string;
	fields: ImportField[];
	rowSchema: z.ZodType;
	/** The header line offered as a template download. */
	template: string[];
}

const enumHint = (values: readonly string[]) => `One of: ${values.join(', ')}`;

/**
 * Free-text class names are matched to an asset type so a spreadsheet that says
 * "Real estate" or "Cash & deposits" imports without the user editing it first.
 */
const ASSET_TYPE_SYNONYMS: Record<string, string> = {
	'cash & deposits': 'cash',
	'cash and deposits': 'cash',
	deposit: 'cash',
	deposits: 'cash',
	savings: 'cash',
	equities: 'stock',
	equity: 'stock',
	shares: 'stock',
	stocks: 'stock',
	'real estate': 'property',
	realestate: 'property',
	house: 'property',
	home: 'property',
	retirement: 'other',
	pension: 'other',
	cooperative: 'other',
	sacco: 'other',
	vehicles: 'vehicle',
	car: 'vehicle',
	funds: 'fund',
	'mutual fund': 'fund',
	bonds: 'bond',
	commodities: 'collectible',
	gold: 'collectible'
};

export function normaliseAssetType(raw: string): string {
	const value = raw.trim().toLowerCase();
	if ((ASSET_TYPES as readonly string[]).includes(value)) return value;
	if (ASSET_TYPE_SYNONYMS[value]) return ASSET_TYPE_SYNONYMS[value];
	const byLabel = Object.entries(ASSET_TYPE_LABELS).find(
		([, label]) => label.toLowerCase() === value
	);
	return byLabel ? byLabel[0] : value;
}

const LIABILITY_TYPE_SYNONYMS: Record<string, string> = {
	'credit card': 'credit_card',
	creditcard: 'credit_card',
	card: 'credit_card',
	'car loan': 'auto_loan',
	auto: 'auto_loan',
	'student loan': 'student_loan',
	student: 'student_loan',
	home: 'mortgage',
	housing: 'mortgage',
	secured: 'other',
	unsecured: 'personal_loan',
	revolving: 'line_of_credit'
};

export function normaliseLiabilityType(raw: string): string {
	const value = raw.trim().toLowerCase();
	if ((LIABILITY_TYPES as readonly string[]).includes(value)) return value;
	if (LIABILITY_TYPE_SYNONYMS[value]) return LIABILITY_TYPE_SYNONYMS[value];
	const byLabel = Object.entries(LIABILITY_TYPE_LABELS).find(
		([, label]) => label.toLowerCase() === value
	);
	return byLabel ? byLabel[0] : value;
}

export function normaliseCashflowCategory(raw: string): string {
	const value = raw.trim().toLowerCase();
	if ((CASHFLOW_CATEGORIES as readonly string[]).includes(value)) return value;
	const byLabel = Object.entries(CASHFLOW_CATEGORY_LABELS).find(
		([, label]) => label.toLowerCase() === value
	);
	return byLabel ? byLabel[0] : value;
}

export const assetRowSchema = z.object({
	name: nameSchema,
	assetType: z
		.string()
		.transform(normaliseAssetType)
		.pipe(enumOf(ASSET_TYPES, `Unrecognised asset class. ${enumHint(ASSET_TYPES)}`)),
	symbol: symbolSchema,
	currency: currencyCodeSchema,
	quantity: quantitySchema('Quantity').default('1'),
	unitPrice: moneySchema('Unit price').default('0'),
	manualValue: optionalMoneySchema('Value'),
	acquisitionCost: optionalMoneySchema('Cost'),
	valuationDate: isoDateSchema
});

export const liabilityRowSchema = z.object({
	name: nameSchema,
	liabilityType: z
		.string()
		.transform(normaliseLiabilityType)
		.pipe(enumOf(LIABILITY_TYPES, `Unrecognised liability type. ${enumHint(LIABILITY_TYPES)}`)),
	currency: currencyCodeSchema,
	originalPrincipal: moneySchema('Original principal'),
	outstandingBalance: moneySchema('Outstanding balance'),
	interestRate: percentSchema('Interest rate'),
	monthlyPayment: optionalMoneySchema('Monthly payment'),
	maturityDate: optionalDateSchema
});

export const cashflowRowSchema = z.object({
	entryType: enumOf(CASHFLOW_ENTRY_TYPES, 'Use "income" or "expense"'),
	category: z
		.string()
		.transform(normaliseCashflowCategory)
		.pipe(enumOf(CASHFLOW_CATEGORIES, 'Unrecognised category')),
	name: nameSchema,
	amount: moneySchema('Amount'),
	currency: currencyCodeSchema,
	frequency: enumOf(FREQUENCIES, enumHint(FREQUENCIES)).default('monthly'),
	entryDate: isoDateSchema
});

export const transactionRowSchema = z.object({
	accountName: z.string().trim().min(1, { message: 'Name the account this belongs to' }),
	symbol: symbolSchema,
	transactionType: enumOf(TRANSACTION_TYPES, enumHint(TRANSACTION_TYPES)),
	transactionDate: isoDateSchema,
	quantity: optionalQuantitySchema('Quantity'),
	unitPrice: optionalMoneySchema('Unit price'),
	grossAmount: moneySchema('Amount'),
	feeAmount: moneySchema('Fees').default('0'),
	taxAmount: moneySchema('Tax').default('0'),
	currency: currencyCodeSchema
});

export const IMPORT_DEFINITIONS: Record<ImportKind, ImportDefinition> = {
	assets: {
		kind: 'assets',
		label: 'Assets',
		description: 'Property, cash, deposits, retirement savings and holdings.',
		rowSchema: assetRowSchema,
		template: [
			'name',
			'asset_type',
			'symbol',
			'currency',
			'quantity',
			'unit_price',
			'value',
			'cost',
			'valuation_date'
		],
		fields: [
			{
				key: 'name',
				label: 'Name',
				required: true,
				aliases: ['name', 'record', 'description', 'holding']
			},
			{
				key: 'assetType',
				label: 'Asset class',
				required: true,
				aliases: ['asset_type', 'assettype', 'class', 'category', 'type'],
				hint: enumHint(ASSET_TYPES)
			},
			{
				key: 'symbol',
				label: 'Ticker',
				required: false,
				aliases: ['symbol', 'ticker', 'isin', 'code']
			},
			{ key: 'currency', label: 'Currency', required: true, aliases: ['currency', 'ccy'] },
			{
				key: 'quantity',
				label: 'Quantity',
				required: false,
				aliases: ['quantity', 'units', 'shares', 'qty']
			},
			{
				key: 'unitPrice',
				label: 'Unit price',
				required: false,
				aliases: ['unit_price', 'price', 'unitprice']
			},
			{
				key: 'manualValue',
				label: 'Value',
				required: false,
				aliases: ['value', 'amount', 'market_value', 'balance']
			},
			{
				key: 'acquisitionCost',
				label: 'Cost',
				required: false,
				aliases: ['cost', 'book_cost', 'acquisition_cost', 'basis']
			},
			{
				key: 'valuationDate',
				label: 'Valuation date',
				required: true,
				aliases: ['valuation_date', 'date', 'as_of', 'valued']
			}
		]
	},
	liabilities: {
		kind: 'liabilities',
		label: 'Liabilities',
		description: 'Loans, mortgages, cards and lines of credit.',
		rowSchema: liabilityRowSchema,
		template: [
			'name',
			'liability_type',
			'currency',
			'original_principal',
			'outstanding_balance',
			'interest_rate',
			'monthly_payment',
			'maturity_date'
		],
		fields: [
			{ key: 'name', label: 'Name', required: true, aliases: ['name', 'liability', 'description'] },
			{
				key: 'liabilityType',
				label: 'Type',
				required: true,
				aliases: ['liability_type', 'type', 'category'],
				hint: enumHint(LIABILITY_TYPES)
			},
			{ key: 'currency', label: 'Currency', required: true, aliases: ['currency', 'ccy'] },
			{
				key: 'originalPrincipal',
				label: 'Original principal',
				required: true,
				aliases: ['original_principal', 'principal', 'original']
			},
			{
				key: 'outstandingBalance',
				label: 'Balance',
				required: true,
				aliases: ['outstanding_balance', 'balance', 'outstanding']
			},
			{
				key: 'interestRate',
				label: 'Interest rate %',
				required: true,
				aliases: ['interest_rate', 'rate', 'apr']
			},
			{
				key: 'monthlyPayment',
				label: 'Monthly payment',
				required: false,
				aliases: ['monthly_payment', 'payment', 'monthly']
			},
			{
				key: 'maturityDate',
				label: 'Maturity date',
				required: false,
				aliases: ['maturity_date', 'maturity', 'end_date']
			}
		]
	},
	cashflow: {
		kind: 'cashflow',
		label: 'Income & expenses',
		description: 'Recurring income streams and expense categories.',
		rowSchema: cashflowRowSchema,
		template: ['entry_type', 'category', 'name', 'amount', 'currency', 'frequency', 'entry_date'],
		fields: [
			{
				key: 'entryType',
				label: 'Income or expense',
				required: true,
				aliases: ['entry_type', 'type', 'direction'],
				hint: 'income or expense'
			},
			{
				key: 'category',
				label: 'Category',
				required: true,
				aliases: ['category', 'bucket', 'group']
			},
			{ key: 'name', label: 'Name', required: true, aliases: ['name', 'description', 'label'] },
			{ key: 'amount', label: 'Amount', required: true, aliases: ['amount', 'value', 'monthly'] },
			{ key: 'currency', label: 'Currency', required: true, aliases: ['currency', 'ccy'] },
			{
				key: 'frequency',
				label: 'Frequency',
				required: false,
				aliases: ['frequency', 'period', 'recurrence'],
				hint: enumHint(FREQUENCIES)
			},
			{
				key: 'entryDate',
				label: 'Start date',
				required: true,
				aliases: ['entry_date', 'date', 'start_date', 'from']
			}
		]
	},
	transactions: {
		kind: 'transactions',
		label: 'Transactions',
		description: 'Buys, sells, dividends, interest, fees and taxes.',
		rowSchema: transactionRowSchema,
		template: [
			'account',
			'symbol',
			'transaction_type',
			'transaction_date',
			'quantity',
			'unit_price',
			'gross_amount',
			'fee_amount',
			'tax_amount',
			'currency'
		],
		fields: [
			{
				key: 'accountName',
				label: 'Account',
				required: true,
				aliases: ['account', 'account_name', 'portfolio']
			},
			{
				key: 'symbol',
				label: 'Ticker',
				required: false,
				aliases: ['symbol', 'ticker', 'isin', 'security']
			},
			{
				key: 'transactionType',
				label: 'Type',
				required: true,
				aliases: ['transaction_type', 'type', 'action', 'side'],
				hint: enumHint(TRANSACTION_TYPES)
			},
			{
				key: 'transactionDate',
				label: 'Date',
				required: true,
				aliases: ['transaction_date', 'date', 'trade_date', 'settled']
			},
			{
				key: 'quantity',
				label: 'Quantity',
				required: false,
				aliases: ['quantity', 'units', 'shares', 'qty']
			},
			{ key: 'unitPrice', label: 'Unit price', required: false, aliases: ['unit_price', 'price'] },
			{
				key: 'grossAmount',
				label: 'Amount',
				required: true,
				aliases: ['gross_amount', 'amount', 'total', 'value']
			},
			{
				key: 'feeAmount',
				label: 'Fees',
				required: false,
				aliases: ['fee_amount', 'fee', 'fees', 'commission']
			},
			{
				key: 'taxAmount',
				label: 'Tax',
				required: false,
				aliases: ['tax_amount', 'tax', 'withholding']
			},
			{ key: 'currency', label: 'Currency', required: true, aliases: ['currency', 'ccy'] }
		]
	}
};

/** Pre-fills the mapping step by matching headers against each field's aliases. */
export function guessMapping(
	kind: ImportKind,
	headers: readonly string[]
): Record<string, string | null> {
	const definition = IMPORT_DEFINITIONS[kind];
	const normalised = headers.map((h) =>
		h
			.trim()
			.toLowerCase()
			.replace(/[\s-]+/g, '_')
	);
	const used = new Set<number>();
	const mapping: Record<string, string | null> = {};

	for (const field of definition.fields) {
		let index = normalised.findIndex((h, i) => !used.has(i) && field.aliases.includes(h));
		if (index === -1) {
			index = normalised.findIndex(
				(h, i) => !used.has(i) && field.aliases.some((alias) => h.includes(alias))
			);
		}
		if (index === -1) {
			mapping[field.key] = null;
		} else {
			used.add(index);
			mapping[field.key] = headers[index];
		}
	}

	return mapping;
}
