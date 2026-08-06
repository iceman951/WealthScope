/**
 * Domain vocabulary shared by the database schema, the Zod schemas, the financial
 * engine and the UI. Browser-safe: no server-only imports live here.
 *
 * Enumerations are persisted as `text` with a CHECK constraint rather than a
 * PostgreSQL enum type, because these lists grow (new asset classes, new
 * transaction types) and altering a CHECK is a one-line migration.
 */

export const ACCOUNT_TYPES = [
	'cash',
	'bank',
	'brokerage',
	'retirement',
	'crypto',
	'property',
	'loan',
	'credit',
	'other'
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
	cash: 'Cash',
	bank: 'Bank',
	brokerage: 'Brokerage',
	retirement: 'Retirement',
	crypto: 'Crypto',
	property: 'Property',
	loan: 'Loan',
	credit: 'Credit',
	other: 'Other'
};

export const ASSET_TYPES = [
	'cash',
	'stock',
	'etf',
	'bond',
	'fund',
	'crypto',
	'property',
	'vehicle',
	'business',
	'collectible',
	'other'
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
	cash: 'Cash & deposits',
	stock: 'Equities',
	etf: 'Funds & ETFs',
	bond: 'Bonds',
	fund: 'Managed funds',
	crypto: 'Crypto',
	property: 'Real estate',
	vehicle: 'Vehicles',
	business: 'Business interests',
	collectible: 'Collectibles',
	other: 'Other'
};

/**
 * Investment "sleeves" as shown on the Investments screen. Derived from the asset
 * type so the user never maintains a second taxonomy.
 */
export const SLEEVES = ['Equities', 'Bonds', 'Commodities', 'Cash equivalents', 'Other'] as const;
export type Sleeve = (typeof SLEEVES)[number];

export function sleeveOf(assetType: AssetType): Sleeve {
	switch (assetType) {
		case 'stock':
		case 'etf':
		case 'fund':
			return 'Equities';
		case 'bond':
			return 'Bonds';
		case 'crypto':
		case 'collectible':
			return 'Commodities';
		case 'cash':
			return 'Cash equivalents';
		default:
			return 'Other';
	}
}

/** Asset types the Investments screen treats as tradeable holdings. */
export const INVESTMENT_ASSET_TYPES: readonly AssetType[] = [
	'stock',
	'etf',
	'bond',
	'fund',
	'crypto'
];

export function isInvestmentType(assetType: AssetType): boolean {
	return INVESTMENT_ASSET_TYPES.includes(assetType);
}

/** The liquidity ladder shown on the dashboard. */
export const LIQUIDITY_BANDS = ['Liquid', 'Semi-liquid', 'Illiquid'] as const;
export type LiquidityBand = (typeof LIQUIDITY_BANDS)[number];

export const LIQUIDITY_NOTES: Record<LiquidityBand, string> = {
	Liquid: 'Cash, deposits at call and marketable securities',
	'Semi-liquid': 'Term deposits, cooperative shares, T-bills',
	Illiquid: 'Property, vehicles, locked retirement savings'
};

/**
 * Liquidity is a property of where the value sits, not of the instrument alone:
 * the same ETF is liquid in a brokerage account and illiquid inside a locked
 * retirement wrapper.
 */
export function liquidityOf(assetType: AssetType, accountType: AccountType | null): LiquidityBand {
	if (accountType === 'retirement') return 'Illiquid';
	switch (assetType) {
		case 'cash':
			return accountType === 'brokerage' || accountType === 'bank' || accountType === 'cash'
				? 'Liquid'
				: 'Semi-liquid';
		case 'stock':
		case 'etf':
		case 'fund':
		case 'crypto':
			return 'Liquid';
		case 'bond':
			return 'Semi-liquid';
		case 'property':
		case 'vehicle':
		case 'business':
		case 'collectible':
			return 'Illiquid';
		default:
			return 'Semi-liquid';
	}
}

export const TRANSACTION_TYPES = [
	'buy',
	'sell',
	'deposit',
	'withdrawal',
	'dividend',
	'interest',
	'fee',
	'tax',
	'transfer',
	'adjustment'
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
	buy: 'Buy',
	sell: 'Sell',
	deposit: 'Deposit',
	withdrawal: 'Withdrawal',
	dividend: 'Dividend',
	interest: 'Interest',
	fee: 'Fee',
	tax: 'Tax',
	transfer: 'Transfer',
	adjustment: 'Adjustment'
};

export const LIABILITY_TYPES = [
	'mortgage',
	'auto_loan',
	'student_loan',
	'personal_loan',
	'credit_card',
	'line_of_credit',
	'business_loan',
	'other'
] as const;
export type LiabilityType = (typeof LIABILITY_TYPES)[number];

export const LIABILITY_TYPE_LABELS: Record<LiabilityType, string> = {
	mortgage: 'Mortgage',
	auto_loan: 'Auto loan',
	student_loan: 'Student loan',
	personal_loan: 'Personal loan',
	credit_card: 'Credit card',
	line_of_credit: 'Line of credit',
	business_loan: 'Business loan',
	other: 'Other'
};

/** Secured / Unsecured / Revolving, the grouping the Liabilities table shows. */
export function liabilityClassOf(type: LiabilityType): 'Secured' | 'Unsecured' | 'Revolving' {
	switch (type) {
		case 'mortgage':
		case 'auto_loan':
		case 'business_loan':
			return 'Secured';
		case 'credit_card':
		case 'line_of_credit':
			return 'Revolving';
		default:
			return 'Unsecured';
	}
}

export const CASHFLOW_ENTRY_TYPES = ['income', 'expense'] as const;
export type CashflowEntryType = (typeof CASHFLOW_ENTRY_TYPES)[number];

export const FREQUENCIES = [
	'once',
	'weekly',
	'biweekly',
	'monthly',
	'quarterly',
	'semiannual',
	'annual'
] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
	once: 'One-off',
	weekly: 'Weekly',
	biweekly: 'Every two weeks',
	monthly: 'Monthly',
	quarterly: 'Quarterly',
	semiannual: 'Twice a year',
	annual: 'Annual'
};

/** Occurrences per year. `once` contributes nothing to a recurring monthly figure. */
export const FREQUENCY_PER_YEAR: Record<Frequency, number> = {
	once: 0,
	weekly: 52,
	biweekly: 26,
	monthly: 12,
	quarterly: 4,
	semiannual: 2,
	annual: 1
};

export const INCOME_CATEGORIES = [
	'salary',
	'business',
	'rental',
	'dividends',
	'interest',
	'pension',
	'other_income'
] as const;

export const EXPENSE_CATEGORIES = [
	'housing',
	'living',
	'taxes',
	'education',
	'transport',
	'insurance',
	'fees',
	'debt_service',
	'other_expense'
] as const;

export const CASHFLOW_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES] as const;
export type CashflowCategory = (typeof CASHFLOW_CATEGORIES)[number];

export const CASHFLOW_CATEGORY_LABELS: Record<CashflowCategory, string> = {
	salary: 'Salary',
	business: 'Business income',
	rental: 'Rental income',
	dividends: 'Dividends',
	interest: 'Interest',
	pension: 'Pension',
	other_income: 'Other income',
	housing: 'Mortgage & housing',
	living: 'Living & groceries',
	taxes: 'Taxes',
	education: 'Childcare & education',
	transport: 'Transport',
	insurance: 'Insurance',
	fees: 'Fees & charges',
	debt_service: 'Debt service',
	other_expense: 'Other'
};

export const GOAL_TYPES = [
	'emergency_fund',
	'retirement',
	'property',
	'education',
	'debt_payoff',
	'travel',
	'other'
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
	emergency_fund: 'Emergency fund',
	retirement: 'Retirement',
	property: 'Property',
	education: 'Education',
	debt_payoff: 'Debt payoff',
	travel: 'Travel',
	other: 'Other'
};

export const GOAL_STATUSES = ['active', 'achieved', 'paused', 'abandoned'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_PRIORITIES = ['low', 'medium', 'high'] as const;
export type GoalPriority = (typeof GOAL_PRIORITIES)[number];

export const PRICE_SOURCES = ['manual', 'import', 'provider'] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];

export const IMPORT_KINDS = ['assets', 'transactions', 'liabilities', 'cashflow'] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export const IMPORT_STATUSES = ['pending', 'completed', 'failed'] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

/**
 * Currencies offered in the UI. Any ISO 4217 code is accepted by validation; this
 * list only drives the pickers. THB leads because the default locale is th-TH.
 */
export const SUPPORTED_CURRENCIES = [
	{ code: 'THB', name: 'Thai Baht' },
	{ code: 'USD', name: 'US Dollar' },
	{ code: 'EUR', name: 'Euro' },
	{ code: 'GBP', name: 'Pound Sterling' },
	{ code: 'JPY', name: 'Japanese Yen' },
	{ code: 'SGD', name: 'Singapore Dollar' },
	{ code: 'AUD', name: 'Australian Dollar' },
	{ code: 'CNY', name: 'Chinese Yuan' }
] as const;

/** Currencies quoted without minor units — never rendered with decimal places. */
export const ZERO_DECIMAL_CURRENCIES = ['JPY', 'KRW', 'VND', 'CLP', 'ISK'] as const;

export const DEFAULT_BASE_CURRENCY = 'THB';
export const DEFAULT_LOCALE = 'th-TH';
export const DEFAULT_TIMEZONE = 'Asia/Bangkok';
export const DEFAULT_RETURN_ASSUMPTION = '6.00000000';
export const DEFAULT_INFLATION_ASSUMPTION = '2.20000000';

export const HEALTH_BANDS = ['Weak', 'Watch', 'Adequate', 'Strong'] as const;
export type HealthBand = (typeof HEALTH_BANDS)[number];

export const FINDING_SEVERITIES = ['Act now', 'Review', 'Healthy'] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];
