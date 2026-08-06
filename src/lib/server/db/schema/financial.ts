import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';
import {
	ACCOUNT_TYPES,
	ASSET_TYPES,
	CASHFLOW_CATEGORIES,
	CASHFLOW_ENTRY_TYPES,
	FREQUENCIES,
	GOAL_PRIORITIES,
	GOAL_STATUSES,
	GOAL_TYPES,
	IMPORT_KINDS,
	IMPORT_STATUSES,
	LIABILITY_TYPES,
	PRICE_SOURCES,
	TRANSACTION_TYPES
} from '$lib/types/domain';
import { user } from './auth';
import {
	createdAt,
	currency,
	fxRate,
	isCurrencyCode,
	isNonNegative,
	money,
	oneOf,
	price,
	quantity,
	rate,
	updatedAt
} from './columns';

/**
 * Delete behaviour is stated on every foreign key rather than inherited.
 *
 *   user      → everything the user owns cascades, so account deletion is complete.
 *   account   → assets/transactions/liabilities detach (`set null`); losing a
 *               wrapper must never silently destroy the holdings inside it.
 *   asset     → prices cascade (a price is meaningless without its asset), and
 *               transactions are restricted: a holding with trade history cannot
 *               be deleted until the history is dealt with explicitly.
 */

export const financialAccounts = pgTable(
	'financial_accounts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: varchar('name', { length: 160 }).notNull(),
		accountType: text('account_type').notNull(),
		institution: varchar('institution', { length: 160 }),
		currency: currency().notNull(),
		description: text('description'),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('financial_accounts_user_idx').on(table.userId),
		index('financial_accounts_user_type_idx').on(table.userId, table.accountType),
		index('financial_accounts_currency_idx').on(table.currency),
		check('financial_accounts_type_chk', oneOf('account_type', ACCOUNT_TYPES)),
		check('financial_accounts_currency_chk', isCurrencyCode('currency'))
	]
);

export const assets = pgTable(
	'assets',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accountId: uuid('account_id').references(() => financialAccounts.id, { onDelete: 'set null' }),
		name: varchar('name', { length: 160 }).notNull(),
		assetType: text('asset_type').notNull(),
		symbol: varchar('symbol', { length: 32 }),
		currency: currency().notNull(),
		quantity: quantity('quantity').notNull().default('1'),
		unitPrice: price('unit_price').notNull().default('0'),
		/**
		 * Set for anything without a per-unit price (a house, a business stake).
		 * When present it wins over quantity × unitPrice.
		 */
		manualValue: money('manual_value'),
		acquisitionCost: money('acquisition_cost'),
		valuationDate: date('valuation_date').notNull(),
		notes: text('notes'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('assets_user_idx').on(table.userId),
		index('assets_user_type_idx').on(table.userId, table.assetType),
		index('assets_account_idx').on(table.accountId),
		index('assets_symbol_idx').on(table.symbol),
		index('assets_currency_idx').on(table.currency),
		index('assets_user_valuation_idx').on(table.userId, table.valuationDate),
		check('assets_type_chk', oneOf('asset_type', ASSET_TYPES)),
		check('assets_currency_chk', isCurrencyCode('currency')),
		check('assets_quantity_chk', isNonNegative('quantity')),
		check('assets_unit_price_chk', isNonNegative('unit_price'))
	]
);

export const transactions = pgTable(
	'transactions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accountId: uuid('account_id')
			.notNull()
			.references(() => financialAccounts.id, { onDelete: 'restrict' }),
		assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'restrict' }),
		transactionType: text('transaction_type').notNull(),
		transactionDate: date('transaction_date').notNull(),
		quantity: quantity('quantity'),
		unitPrice: price('unit_price'),
		grossAmount: money('gross_amount').notNull(),
		feeAmount: money('fee_amount').notNull().default('0'),
		taxAmount: money('tax_amount').notNull().default('0'),
		currency: currency().notNull(),
		/** Rate to the portfolio base currency on the transaction date, when known. */
		exchangeRate: fxRate('exchange_rate'),
		notes: text('notes'),
		/** Set when the row came from a CSV import; used for duplicate detection. */
		importBatchId: uuid('import_batch_id').references((): AnyPgColumn => importBatches.id, {
			onDelete: 'set null'
		}),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('transactions_user_idx').on(table.userId),
		index('transactions_user_date_idx').on(table.userId, table.transactionDate),
		index('transactions_account_idx').on(table.accountId),
		index('transactions_asset_idx').on(table.assetId),
		index('transactions_user_type_idx').on(table.userId, table.transactionType),
		index('transactions_currency_idx').on(table.currency),
		check('transactions_type_chk', oneOf('transaction_type', TRANSACTION_TYPES)),
		check('transactions_currency_chk', isCurrencyCode('currency')),
		check('transactions_fee_chk', isNonNegative('fee_amount')),
		check('transactions_tax_chk', isNonNegative('tax_amount'))
	]
);

export const liabilities = pgTable(
	'liabilities',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accountId: uuid('account_id').references(() => financialAccounts.id, { onDelete: 'set null' }),
		name: varchar('name', { length: 160 }).notNull(),
		liabilityType: text('liability_type').notNull(),
		currency: currency().notNull(),
		originalPrincipal: money('original_principal').notNull(),
		outstandingBalance: money('outstanding_balance').notNull(),
		/** Nominal annual rate as a percentage: 3.4 means 3.4% p.a. */
		interestRate: rate('interest_rate').notNull(),
		minimumPayment: money('minimum_payment'),
		monthlyPayment: money('monthly_payment'),
		startDate: date('start_date'),
		maturityDate: date('maturity_date'),
		notes: text('notes'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('liabilities_user_idx').on(table.userId),
		index('liabilities_user_type_idx').on(table.userId, table.liabilityType),
		index('liabilities_account_idx').on(table.accountId),
		index('liabilities_currency_idx').on(table.currency),
		index('liabilities_user_maturity_idx').on(table.userId, table.maturityDate),
		check('liabilities_type_chk', oneOf('liability_type', LIABILITY_TYPES)),
		check('liabilities_currency_chk', isCurrencyCode('currency')),
		check('liabilities_balance_chk', isNonNegative('outstanding_balance')),
		check('liabilities_principal_chk', isNonNegative('original_principal')),
		check('liabilities_rate_chk', isNonNegative('interest_rate'))
	]
);

export const cashflowEntries = pgTable(
	'cashflow_entries',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		entryType: text('entry_type').notNull(),
		category: text('category').notNull(),
		name: varchar('name', { length: 160 }).notNull(),
		/** Always stored positive; direction comes from `entryType`. */
		amount: money('amount').notNull(),
		currency: currency().notNull(),
		frequency: text('frequency').notNull(),
		entryDate: date('entry_date').notNull(),
		endDate: date('end_date'),
		isRecurring: boolean('is_recurring').notNull().default(true),
		notes: text('notes'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('cashflow_user_idx').on(table.userId),
		index('cashflow_user_type_idx').on(table.userId, table.entryType),
		index('cashflow_user_date_idx').on(table.userId, table.entryDate),
		index('cashflow_currency_idx').on(table.currency),
		check('cashflow_entry_type_chk', oneOf('entry_type', CASHFLOW_ENTRY_TYPES)),
		check('cashflow_category_chk', oneOf('category', CASHFLOW_CATEGORIES)),
		check('cashflow_frequency_chk', oneOf('frequency', FREQUENCIES)),
		check('cashflow_currency_chk', isCurrencyCode('currency')),
		check('cashflow_amount_chk', isNonNegative('amount'))
	]
);

export const assetPrices = pgTable(
	'asset_prices',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		assetId: uuid('asset_id')
			.notNull()
			.references(() => assets.id, { onDelete: 'cascade' }),
		price: price('price').notNull(),
		currency: currency().notNull(),
		priceDate: date('price_date').notNull(),
		source: text('source').notNull().default('manual'),
		createdAt: createdAt()
	},
	(table) => [
		uniqueIndex('asset_prices_unique').on(table.assetId, table.priceDate, table.source),
		index('asset_prices_asset_date_idx').on(table.assetId, table.priceDate),
		check('asset_prices_source_chk', oneOf('source', PRICE_SOURCES)),
		check('asset_prices_currency_chk', isCurrencyCode('currency')),
		check('asset_prices_price_chk', isNonNegative('price'))
	]
);

export const exchangeRates = pgTable(
	'exchange_rates',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		baseCurrency: currency('base_currency').notNull(),
		quoteCurrency: currency('quote_currency').notNull(),
		/** 1 base = `rate` quote. */
		rate: fxRate('rate').notNull(),
		rateDate: date('rate_date').notNull(),
		source: text('source').notNull().default('manual'),
		createdAt: createdAt()
	},
	(table) => [
		uniqueIndex('exchange_rates_unique').on(
			table.baseCurrency,
			table.quoteCurrency,
			table.rateDate,
			table.source
		),
		index('exchange_rates_pair_date_idx').on(
			table.baseCurrency,
			table.quoteCurrency,
			table.rateDate
		),
		check('exchange_rates_base_chk', isCurrencyCode('base_currency')),
		check('exchange_rates_quote_chk', isCurrencyCode('quote_currency')),
		check('exchange_rates_rate_chk', sql`rate > 0`)
	]
);

export const portfolioSnapshots = pgTable(
	'portfolio_snapshots',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		snapshotDate: date('snapshot_date').notNull(),
		baseCurrency: currency('base_currency').notNull(),
		totalAssets: money('total_assets').notNull(),
		totalLiabilities: money('total_liabilities').notNull(),
		netWorth: money('net_worth').notNull(),
		liquidAssets: money('liquid_assets').notNull(),
		investmentAssets: money('investment_assets').notNull(),
		/** Allocation breakdown and the FX rates used, so a snapshot stays reproducible. */
		metadataJson: jsonb('metadata_json'),
		createdAt: createdAt()
	},
	(table) => [
		uniqueIndex('portfolio_snapshots_user_date_unique').on(table.userId, table.snapshotDate),
		index('portfolio_snapshots_user_date_idx').on(table.userId, table.snapshotDate),
		check('portfolio_snapshots_currency_chk', isCurrencyCode('base_currency'))
	]
);

export const financialGoals = pgTable(
	'financial_goals',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: varchar('name', { length: 160 }).notNull(),
		goalType: text('goal_type').notNull(),
		targetAmount: money('target_amount').notNull(),
		currentAmount: money('current_amount').notNull().default('0'),
		currency: currency().notNull(),
		targetDate: date('target_date'),
		priority: text('priority').notNull().default('medium'),
		status: text('status').notNull().default('active'),
		notes: text('notes'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('financial_goals_user_idx').on(table.userId),
		index('financial_goals_user_status_idx').on(table.userId, table.status),
		index('financial_goals_user_target_date_idx').on(table.userId, table.targetDate),
		check('financial_goals_type_chk', oneOf('goal_type', GOAL_TYPES)),
		check('financial_goals_status_chk', oneOf('status', GOAL_STATUSES)),
		check('financial_goals_priority_chk', oneOf('priority', GOAL_PRIORITIES)),
		check('financial_goals_currency_chk', isCurrencyCode('currency')),
		check('financial_goals_target_chk', sql`target_amount > 0`)
	]
);

export const userFinancialSettings = pgTable(
	'user_financial_settings',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),
		baseCurrency: currency('base_currency').notNull().default('THB'),
		locale: varchar('locale', { length: 16 }).notNull().default('th-TH'),
		timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Bangkok'),
		fiscalYearStartMonth: integer('fiscal_year_start_month').notNull().default(1),
		/** Percentages: 6 means 6% nominal annual return. */
		defaultReturnAssumption: rate('default_return_assumption').notNull().default('6'),
		defaultInflationAssumption: rate('default_inflation_assumption').notNull().default('2.2'),
		/** Months of expenses the liquidity-cover score is graded against. */
		emergencyFundMonths: integer('emergency_fund_months').notNull().default(6),
		/** The design's Rounding preference: 0 = "Whole", 2 = "2 dp". Display only. */
		displayDecimals: integer('display_decimals').notNull().default(0),
		birthYear: integer('birth_year'),
		retirementAge: integer('retirement_age'),
		/** Set once the three-step first-run wizard completes; null means "show it". */
		onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	// This table has no indexes of its own — the primary key is the user id — so
	// the callback ignores its argument and returns only the check constraints.
	() => [
		check('user_settings_currency_chk', isCurrencyCode('base_currency')),
		check('user_settings_fiscal_month_chk', sql`fiscal_year_start_month BETWEEN 1 AND 12`),
		check('user_settings_emergency_chk', sql`emergency_fund_months BETWEEN 1 AND 36`),
		check('user_settings_display_decimals_chk', sql`display_decimals IN (0, 2)`)
	]
);

export const importBatches = pgTable(
	'import_batches',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		kind: text('kind').notNull(),
		/** File name only. CSV contents are never persisted or logged. */
		fileName: varchar('file_name', { length: 255 }).notNull(),
		fileSize: integer('file_size').notNull(),
		/** SHA-256 of the uploaded bytes, used to warn about a repeat import. */
		contentHash: varchar('content_hash', { length: 64 }).notNull(),
		rowCount: integer('row_count').notNull().default(0),
		importedCount: integer('imported_count').notNull().default(0),
		rejectedCount: integer('rejected_count').notNull().default(0),
		status: text('status').notNull().default('pending'),
		errorSummary: text('error_summary'),
		createdAt: createdAt()
	},
	(table) => [
		index('import_batches_user_idx').on(table.userId),
		index('import_batches_user_hash_idx').on(table.userId, table.contentHash),
		check('import_batches_kind_chk', oneOf('kind', IMPORT_KINDS)),
		check('import_batches_status_chk', oneOf('status', IMPORT_STATUSES))
	]
);
