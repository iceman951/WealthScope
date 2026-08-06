/**
 * Development seed.
 *
 * Creates one clearly fictional demo account with a complete household balance
 * sheet, so every screen has something to show. Refuses to run against anything
 * that looks like production.
 *
 *   pnpm db:seed
 *   pnpm db:seed -- --reset     (wipes the demo user's records first)
 */

import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';
import { scryptSync, randomBytes, randomUUID } from 'node:crypto';
import * as schema from '../src/lib/server/db/schema/index';

const DEMO_EMAIL = 'demo@wealthscope.example';
const DEMO_PASSWORD = 'demo-password-1234';
const DEMO_NAME = 'Alex Demo';

function assertNotProduction(url: string) {
	if (process.env.NODE_ENV === 'production' || process.env.WEALTHSCOPE_ENV === 'production') {
		throw new Error('Refusing to seed: NODE_ENV is production.');
	}
	if (/prod|production/i.test(url)) {
		throw new Error('Refusing to seed: DATABASE_URL looks like a production database.');
	}
}

/**
 * Better Auth's scrypt parameters. Matching them means the seeded account can
 * sign in through the normal form rather than needing a special path.
 */
function hashPassword(password: string): string {
	const salt = randomBytes(16).toString('hex');
	const key = scryptSync(password.normalize('NFKC'), salt, 64, {
		N: 16384,
		r: 16,
		p: 1,
		maxmem: 128 * 16384 * 16 * 2
	});
	return `${salt}:${key.toString('hex')}`;
}

const today = new Date();
const iso = (date: Date) => date.toISOString().slice(0, 10);
const monthsAgo = (n: number) =>
	iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - n, 15)));

async function main() {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error('DATABASE_URL is not set.');
	assertNotProduction(url);

	const reset = process.argv.includes('--reset');
	const pool = new Pool({ connectionString: url });
	const db = drizzle(pool, { schema, casing: 'snake_case' });

	try {
		const existing = await db
			.select()
			.from(schema.user)
			.where(eq(schema.user.email, DEMO_EMAIL))
			.limit(1);

		let userId = existing[0]?.id;

		if (!userId) {
			userId = randomUUID();
			const now = new Date();
			await db.insert(schema.user).values({
				id: userId,
				name: DEMO_NAME,
				email: DEMO_EMAIL,
				emailVerified: true,
				createdAt: now,
				updatedAt: now
			});
			await db.insert(schema.account).values({
				id: randomUUID(),
				accountId: userId,
				providerId: 'credential',
				userId,
				password: hashPassword(DEMO_PASSWORD),
				createdAt: now,
				updatedAt: now
			});
			console.log(`Created demo user ${DEMO_EMAIL}`);
		} else if (reset) {
			// Order matters: transactions reference accounts and assets with RESTRICT.
			await db.delete(schema.transactions).where(eq(schema.transactions.userId, userId));
			// asset_prices cascade from assets, so deleting the assets clears them.
			await db.delete(schema.assets).where(eq(schema.assets.userId, userId));
			await db.delete(schema.liabilities).where(eq(schema.liabilities.userId, userId));
			await db.delete(schema.cashflowEntries).where(eq(schema.cashflowEntries.userId, userId));
			await db
				.delete(schema.portfolioSnapshots)
				.where(eq(schema.portfolioSnapshots.userId, userId));
			await db.delete(schema.financialGoals).where(eq(schema.financialGoals.userId, userId));
			await db.delete(schema.importBatches).where(eq(schema.importBatches.userId, userId));
			await db.delete(schema.financialAccounts).where(eq(schema.financialAccounts.userId, userId));
			console.log('Cleared existing demo records');
		} else {
			console.log('Demo user already exists. Re-run with --reset to rebuild the dataset.');
			return;
		}

		await db
			.insert(schema.userFinancialSettings)
			.values({
				userId,
				baseCurrency: 'THB',
				locale: 'th-TH',
				timezone: 'Asia/Bangkok',
				fiscalYearStartMonth: 1,
				defaultReturnAssumption: '6',
				defaultInflationAssumption: '2.2',
				emergencyFundMonths: 6,
				displayDecimals: 0,
				birthYear: 1988,
				retirementAge: 62,
				onboardedAt: new Date()
			})
			.onConflictDoUpdate({
				target: schema.userFinancialSettings.userId,
				set: { onboardedAt: new Date(), birthYear: 1988, retirementAge: 62 }
			});

		/* ── exchange rates (shared reference data) ──────────────────────────── */
		const rates = [
			{ baseCurrency: 'USD', quoteCurrency: 'THB', rate: '36.500000000000' },
			{ baseCurrency: 'EUR', quoteCurrency: 'THB', rate: '39.200000000000' },
			{ baseCurrency: 'SGD', quoteCurrency: 'THB', rate: '27.100000000000' }
		];
		for (const rate of rates) {
			await db
				.insert(schema.exchangeRates)
				.values({ ...rate, rateDate: iso(today), source: 'manual' })
				.onConflictDoNothing();
		}

		/* ── accounts ────────────────────────────────────────────────────────── */
		const accountRows = await db
			.insert(schema.financialAccounts)
			.values([
				{
					userId,
					name: 'Everyday current account',
					accountType: 'bank',
					institution: 'Demo Bank',
					currency: 'THB',
					description: 'Salary lands here'
				},
				{
					userId,
					name: 'Emergency savings',
					accountType: 'bank',
					institution: 'Demo Bank',
					currency: 'THB'
				},
				{
					userId,
					name: 'Brokerage',
					accountType: 'brokerage',
					institution: 'Demo Securities',
					currency: 'USD'
				},
				{
					userId,
					name: 'Provident fund',
					accountType: 'retirement',
					institution: 'Demo Asset Management',
					currency: 'THB',
					description: 'Locked until 55'
				},
				{
					userId,
					name: 'Home loan',
					accountType: 'loan',
					institution: 'Demo Bank',
					currency: 'THB'
				}
			])
			.returning({ id: schema.financialAccounts.id, name: schema.financialAccounts.name });

		const accountId = (name: string) => accountRows.find((a) => a.name === name)!.id;

		/* ── assets ──────────────────────────────────────────────────────────── */
		const assetRows = await db
			.insert(schema.assets)
			.values([
				{
					userId,
					accountId: null,
					name: 'Condominium — Sukhumvit',
					assetType: 'property',
					currency: 'THB',
					quantity: '1',
					unitPrice: '0',
					manualValue: '8400000',
					acquisitionCost: '7200000',
					valuationDate: monthsAgo(1),
					notes: 'Owner-occupied. Fictional demo record.'
				},
				{
					userId,
					accountId: accountId('Everyday current account'),
					name: 'Current account balance',
					assetType: 'cash',
					currency: 'THB',
					quantity: '1',
					unitPrice: '182400',
					valuationDate: iso(today)
				},
				{
					userId,
					accountId: accountId('Emergency savings'),
					name: 'Emergency savings',
					assetType: 'cash',
					currency: 'THB',
					quantity: '1',
					unitPrice: '640000',
					valuationDate: iso(today),
					notes: 'Instant access'
				},
				{
					userId,
					accountId: accountId('Provident fund'),
					name: 'Provident fund',
					assetType: 'fund',
					currency: 'THB',
					quantity: '1',
					unitPrice: '1960000',
					acquisitionCost: '1480000',
					valuationDate: monthsAgo(1)
				},
				{
					userId,
					accountId: null,
					name: 'Vehicle',
					assetType: 'vehicle',
					currency: 'THB',
					quantity: '1',
					unitPrice: '0',
					manualValue: '520000',
					acquisitionCost: '890000',
					valuationDate: monthsAgo(2),
					notes: 'Depreciating'
				},
				{
					userId,
					accountId: accountId('Brokerage'),
					name: 'FTSE All-World ETF',
					assetType: 'etf',
					symbol: 'VWRA',
					currency: 'USD',
					quantity: '412',
					unitPrice: '142.80',
					acquisitionCost: '48900',
					valuationDate: iso(today)
				},
				{
					userId,
					accountId: accountId('Brokerage'),
					name: 'S&P 500 ETF',
					assetType: 'etf',
					symbol: 'CSPX',
					currency: 'USD',
					quantity: '61',
					unitPrice: '624.10',
					acquisitionCost: '29100',
					valuationDate: iso(today)
				},
				{
					userId,
					accountId: accountId('Brokerage'),
					name: 'Global aggregate bond ETF',
					assetType: 'bond',
					symbol: 'AGGU',
					currency: 'USD',
					quantity: '1800',
					unitPrice: '5.42',
					acquisitionCost: '10400',
					valuationDate: iso(today)
				},
				{
					userId,
					accountId: accountId('Brokerage'),
					name: 'Physical gold ETC',
					assetType: 'collectible',
					symbol: 'SGLN',
					currency: 'USD',
					quantity: '310',
					unitPrice: '38.60',
					acquisitionCost: '8100',
					valuationDate: iso(today)
				}
			])
			.returning({ id: schema.assets.id, symbol: schema.assets.symbol, name: schema.assets.name });

		const assetId = (symbol: string) => assetRows.find((a) => a.symbol === symbol)!.id;

		/* ── price history (24 months, so risk metrics have enough data) ────── */
		const priceSeeds: { symbol: string; start: number; drift: number; wobble: number }[] = [
			{ symbol: 'VWRA', start: 108, drift: 0.0125, wobble: 0.035 },
			{ symbol: 'CSPX', start: 470, drift: 0.0135, wobble: 0.04 },
			{ symbol: 'AGGU', start: 5.2, drift: 0.0015, wobble: 0.012 },
			{ symbol: 'SGLN', start: 31, drift: 0.0085, wobble: 0.03 }
		];

		for (const seed of priceSeeds) {
			const rows = [];
			let price = seed.start;
			for (let i = 26; i >= 0; i--) {
				// Deterministic pseudo-noise: the same seed always produces the same
				// series, so screenshots and tests stay stable.
				const noise = Math.sin(i * 1.7 + seed.start) * seed.wobble;
				price = price * (1 + seed.drift + noise);
				rows.push({
					assetId: assetId(seed.symbol),
					price: price.toFixed(8),
					currency: 'USD',
					priceDate: monthsAgo(i),
					source: 'manual' as const
				});
			}
			await db.insert(schema.assetPrices).values(rows).onConflictDoNothing();
		}

		/* ── transactions ────────────────────────────────────────────────────── */
		await db.insert(schema.transactions).values([
			{
				userId,
				accountId: accountId('Brokerage'),
				assetId: assetId('VWRA'),
				transactionType: 'buy',
				transactionDate: monthsAgo(24),
				quantity: '260',
				unitPrice: '112.50',
				grossAmount: '29250',
				feeAmount: '18',
				taxAmount: '0',
				currency: 'USD'
			},
			{
				userId,
				accountId: accountId('Brokerage'),
				assetId: assetId('VWRA'),
				transactionType: 'buy',
				transactionDate: monthsAgo(10),
				quantity: '152',
				unitPrice: '128.60',
				grossAmount: '19547.20',
				feeAmount: '15',
				taxAmount: '0',
				currency: 'USD'
			},
			{
				userId,
				accountId: accountId('Brokerage'),
				assetId: assetId('CSPX'),
				transactionType: 'buy',
				transactionDate: monthsAgo(18),
				quantity: '61',
				unitPrice: '477.05',
				grossAmount: '29100',
				feeAmount: '20',
				taxAmount: '0',
				currency: 'USD'
			},
			{
				userId,
				accountId: accountId('Brokerage'),
				assetId: assetId('SGLN'),
				transactionType: 'buy',
				transactionDate: monthsAgo(14),
				quantity: '310',
				unitPrice: '26.13',
				grossAmount: '8100',
				feeAmount: '12',
				taxAmount: '0',
				currency: 'USD'
			},
			{
				userId,
				accountId: accountId('Brokerage'),
				assetId: assetId('VWRA'),
				transactionType: 'dividend',
				transactionDate: monthsAgo(3),
				grossAmount: '418.60',
				feeAmount: '0',
				taxAmount: '62.80',
				currency: 'USD'
			},
			{
				userId,
				accountId: accountId('Emergency savings'),
				assetId: null,
				transactionType: 'interest',
				transactionDate: monthsAgo(1),
				grossAmount: '1640',
				feeAmount: '0',
				taxAmount: '246',
				currency: 'THB'
			}
		]);

		/* ── liabilities ─────────────────────────────────────────────────────── */
		await db.insert(schema.liabilities).values([
			{
				userId,
				accountId: accountId('Home loan'),
				name: 'Mortgage — condominium',
				liabilityType: 'mortgage',
				currency: 'THB',
				originalPrincipal: '5600000',
				outstandingBalance: '4180000',
				interestRate: '3.4',
				monthlyPayment: '31200',
				minimumPayment: '31200',
				startDate: '2019-04-01',
				maturityDate: '2044-04-01'
			},
			{
				userId,
				name: 'Car loan',
				liabilityType: 'auto_loan',
				currency: 'THB',
				originalPrincipal: '620000',
				outstandingBalance: '186000',
				interestRate: '6.9',
				monthlyPayment: '11400',
				maturityDate: '2028-02-01'
			},
			{
				userId,
				name: 'Credit card',
				liabilityType: 'credit_card',
				currency: 'THB',
				originalPrincipal: '48000',
				outstandingBalance: '48000',
				interestRate: '18.9',
				minimumPayment: '4800',
				monthlyPayment: '4800'
			}
		]);

		/* ── cash flow ───────────────────────────────────────────────────────── */
		await db.insert(schema.cashflowEntries).values([
			{
				userId,
				entryType: 'income',
				category: 'salary',
				name: 'Salary — net',
				amount: '148000',
				currency: 'THB',
				frequency: 'monthly',
				entryDate: monthsAgo(24),
				isRecurring: true,
				notes: 'After payroll tax'
			},
			{
				userId,
				entryType: 'income',
				category: 'rental',
				name: 'Rental income — studio',
				amount: '18000',
				currency: 'THB',
				frequency: 'monthly',
				entryDate: monthsAgo(14),
				isRecurring: true
			},
			{
				userId,
				entryType: 'income',
				category: 'dividends',
				name: 'Portfolio dividends',
				amount: '9200',
				currency: 'THB',
				frequency: 'quarterly',
				entryDate: monthsAgo(12),
				isRecurring: true
			},
			{
				userId,
				entryType: 'expense',
				category: 'housing',
				name: 'Mortgage & building fees',
				amount: '36400',
				currency: 'THB',
				frequency: 'monthly',
				entryDate: monthsAgo(24),
				isRecurring: true
			},
			{
				userId,
				entryType: 'expense',
				category: 'living',
				name: 'Living & groceries',
				amount: '34000',
				currency: 'THB',
				frequency: 'monthly',
				entryDate: monthsAgo(24),
				isRecurring: true
			},
			{
				userId,
				entryType: 'expense',
				category: 'taxes',
				name: 'Income tax settlement',
				amount: '96000',
				currency: 'THB',
				frequency: 'annual',
				entryDate: monthsAgo(20),
				isRecurring: true
			},
			{
				userId,
				entryType: 'expense',
				category: 'transport',
				name: 'Transport & fuel',
				amount: '8600',
				currency: 'THB',
				frequency: 'monthly',
				entryDate: monthsAgo(24),
				isRecurring: true
			},
			{
				userId,
				entryType: 'expense',
				category: 'insurance',
				name: 'Health & motor insurance',
				amount: '52000',
				currency: 'THB',
				frequency: 'annual',
				entryDate: monthsAgo(18),
				isRecurring: true
			},
			{
				userId,
				entryType: 'expense',
				category: 'education',
				name: 'Childcare',
				amount: '14000',
				currency: 'THB',
				frequency: 'monthly',
				entryDate: monthsAgo(10),
				isRecurring: true
			},
			{
				userId,
				entryType: 'expense',
				category: 'fees',
				name: 'Custody & platform fees',
				amount: '1800',
				currency: 'THB',
				frequency: 'quarterly',
				entryDate: monthsAgo(20),
				isRecurring: true
			},
			{
				userId,
				entryType: 'expense',
				category: 'other_expense',
				name: 'New laptop',
				amount: '68000',
				currency: 'THB',
				frequency: 'once',
				entryDate: monthsAgo(2),
				isRecurring: false
			}
		]);

		/* ── goals ───────────────────────────────────────────────────────────── */
		await db.insert(schema.financialGoals).values([
			{
				userId,
				name: 'Six months of expenses',
				goalType: 'emergency_fund',
				targetAmount: '560000',
				currentAmount: '640000',
				currency: 'THB',
				priority: 'high',
				status: 'achieved'
			},
			{
				userId,
				name: 'Clear the credit card',
				goalType: 'debt_payoff',
				targetAmount: '48000',
				currentAmount: '0',
				currency: 'THB',
				targetDate: monthsAgo(-6),
				priority: 'high',
				status: 'active'
			},
			{
				userId,
				name: 'Retire at 62',
				goalType: 'retirement',
				targetAmount: '30000000',
				currentAmount: '1960000',
				currency: 'THB',
				priority: 'medium',
				status: 'active'
			}
		]);

		/* ── snapshots (a trailing net-worth history the dashboard can plot) ─── */
		const snapshotRows = [];
		for (let i = 23; i >= 0; i--) {
			const growth = 1 + (23 - i) * 0.011;
			const assetsTotal = 11_200_000 * growth;
			const liabilitiesTotal = 4_900_000 - (23 - i) * 26_000;
			snapshotRows.push({
				userId,
				snapshotDate: monthsAgo(i),
				baseCurrency: 'THB',
				totalAssets: assetsTotal.toFixed(8),
				totalLiabilities: liabilitiesTotal.toFixed(8),
				netWorth: (assetsTotal - liabilitiesTotal).toFixed(8),
				liquidAssets: (assetsTotal * 0.22).toFixed(8),
				investmentAssets: (assetsTotal * 0.31).toFixed(8),
				metadataJson: { source: 'seed' }
			});
		}
		await db.insert(schema.portfolioSnapshots).values(snapshotRows).onConflictDoNothing();

		console.log('\nSeed complete. Sign in with:');
		console.log(`  email:    ${DEMO_EMAIL}`);
		console.log(`  password: ${DEMO_PASSWORD}`);
		console.log('\nEvery figure above is fictional demo data.');
	} finally {
		await pool.end();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
