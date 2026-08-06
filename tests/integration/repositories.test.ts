import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	createTestDb,
	createTestUser,
	deleteTestUser,
	hasDatabase,
	type TestDb,
	type TestUser
} from './setup';
import * as accountsRepo from '../../src/lib/server/repositories/accounts';
import * as assetsRepo from '../../src/lib/server/repositories/assets';
import * as cashflowRepo from '../../src/lib/server/repositories/cashflow';
import * as liabilitiesRepo from '../../src/lib/server/repositories/liabilities';
import * as snapshotsRepo from '../../src/lib/server/repositories/snapshots';
import * as transactionsRepo from '../../src/lib/server/repositories/transactions';
import { getSettings, upsertSettings } from '../../src/lib/server/repositories/settings';

/**
 * Repository and cross-user isolation tests.
 *
 * The central claim under test: no repository method can reach a row belonging
 * to another user, whatever id is handed to it.
 */

const suite = hasDatabase ? describe : describe.skip;

suite('repositories (integration)', () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let alice: TestUser;
	let mallory: TestUser;

	beforeAll(async () => {
		({ db, close } = createTestDb());
		alice = await createTestUser(db, 'alice');
		mallory = await createTestUser(db, 'mallory');
	}, 30_000);

	afterAll(async () => {
		if (!db) return;
		await deleteTestUser(db, alice.id);
		await deleteTestUser(db, mallory.id);
		await close();
	}, 30_000);

	describe('accounts', () => {
		it('creates and lists a user’s own accounts', async () => {
			const created = await accountsRepo.createAccount(
				alice.id,
				{
					name: 'Alice bank',
					accountType: 'bank',
					institution: null,
					currency: 'THB',
					description: null,
					isActive: true
				},
				db
			);
			expect(created.userId).toBe(alice.id);

			const listed = await accountsRepo.listAccounts(alice.id, db);
			expect(listed.some((a) => a.id === created.id)).toBe(true);
		});

		it('does not return another user’s account by id', async () => {
			const created = await accountsRepo.createAccount(
				alice.id,
				{
					name: 'Alice private',
					accountType: 'brokerage',
					institution: null,
					currency: 'THB',
					description: null,
					isActive: true
				},
				db
			);

			// Mallory knows the id, but the query is scoped by user.
			expect(await accountsRepo.findAccount(mallory.id, created.id, db)).toBeNull();
		});

		it('refuses to update or delete another user’s account', async () => {
			const created = await accountsRepo.createAccount(
				alice.id,
				{
					name: 'Alice target',
					accountType: 'bank',
					institution: null,
					currency: 'THB',
					description: null,
					isActive: true
				},
				db
			);

			const updated = await accountsRepo.updateAccount(
				mallory.id,
				created.id,
				{
					name: 'Owned by Mallory',
					accountType: 'bank',
					institution: null,
					currency: 'THB',
					description: null,
					isActive: true
				},
				db
			);
			expect(updated).toBeUndefined();

			expect(await accountsRepo.deleteAccount(mallory.id, created.id, db)).toBe(false);

			// Alice's record is untouched.
			const stillThere = await accountsRepo.findAccount(alice.id, created.id, db);
			expect(stillThere?.name).toBe('Alice target');
		});
	});

	describe('assets', () => {
		it('scopes reads and writes to the owner', async () => {
			const asset = await assetsRepo.createAsset(
				alice.id,
				{
					name: 'Alice savings',
					assetType: 'cash',
					accountId: null,
					symbol: null,
					currency: 'THB',
					quantity: '1',
					unitPrice: '100000',
					manualValue: null,
					acquisitionCost: null,
					valuationDate: '2026-08-01',
					notes: null
				},
				db
			);

			expect(await assetsRepo.findAsset(mallory.id, asset.id, db)).toBeNull();
			expect(await assetsRepo.deleteAsset(mallory.id, asset.id, db)).toBe(false);

			const mine = await assetsRepo.listAssets(alice.id, {}, db);
			const theirs = await assetsRepo.listAssets(mallory.id, {}, db);
			expect(mine.some((a) => a.id === asset.id)).toBe(true);
			expect(theirs.some((a) => a.id === asset.id)).toBe(false);
		});

		it('refuses to record a price against another user’s holding', async () => {
			const asset = await assetsRepo.createAsset(
				alice.id,
				{
					name: 'Alice ETF',
					assetType: 'etf',
					accountId: null,
					symbol: 'VWRA',
					currency: 'USD',
					quantity: '10',
					unitPrice: '100',
					manualValue: null,
					acquisitionCost: '900',
					valuationDate: '2026-08-01',
					notes: null
				},
				db
			);

			const result = await assetsRepo.recordPrice(
				mallory.id,
				{ assetId: asset.id, price: '1', currency: 'USD', priceDate: '2026-08-02' },
				db
			);
			expect(result).toBeNull();

			// And the holding's own valuation is unchanged.
			const unchanged = await assetsRepo.findAsset(alice.id, asset.id, db);
			expect(unchanged?.unitPrice).toBe('100.00000000');
		});

		it('records a price and revalues the holding for its owner', async () => {
			const asset = await assetsRepo.createAsset(
				alice.id,
				{
					name: 'Alice fund',
					assetType: 'fund',
					accountId: null,
					symbol: 'FUND',
					currency: 'USD',
					quantity: '10',
					unitPrice: '100',
					manualValue: null,
					acquisitionCost: null,
					valuationDate: '2026-08-01',
					notes: null
				},
				db
			);

			await assetsRepo.recordPrice(
				alice.id,
				{ assetId: asset.id, price: '125.5', currency: 'USD', priceDate: '2026-08-05' },
				db
			);

			const updated = await assetsRepo.findAsset(alice.id, asset.id, db);
			expect(Number(updated?.unitPrice)).toBe(125.5);
			expect(updated?.valuationDate).toBe('2026-08-05');

			const history = await assetsRepo.listPriceHistory(alice.id, [asset.id], db);
			expect(history.length).toBeGreaterThan(0);

			// Mallory cannot read the history either.
			expect(await assetsRepo.listPriceHistory(mallory.id, [asset.id], db)).toHaveLength(0);
		});
	});

	describe('liabilities and cash flow', () => {
		it('scopes liabilities to the owner', async () => {
			const created = await liabilitiesRepo.createLiability(
				alice.id,
				{
					name: 'Alice mortgage',
					liabilityType: 'mortgage',
					accountId: null,
					currency: 'THB',
					originalPrincipal: '1000000',
					outstandingBalance: '800000',
					interestRate: '3.4',
					minimumPayment: null,
					monthlyPayment: '6000',
					startDate: null,
					maturityDate: null,
					notes: null
				},
				db
			);

			expect(await liabilitiesRepo.findLiability(mallory.id, created.id, db)).toBeNull();
			expect(await liabilitiesRepo.deleteLiability(mallory.id, created.id, db)).toBe(false);
			expect(await liabilitiesRepo.findLiability(alice.id, created.id, db)).not.toBeNull();
		});

		it('scopes cash-flow entries to the owner', async () => {
			const created = await cashflowRepo.createCashflowEntry(
				alice.id,
				{
					entryType: 'income',
					category: 'salary',
					name: 'Alice salary',
					amount: '100000',
					currency: 'THB',
					frequency: 'monthly',
					entryDate: '2026-01-01',
					endDate: null,
					isRecurring: true,
					notes: null
				},
				db
			);

			expect(await cashflowRepo.findCashflowEntry(mallory.id, created.id, db)).toBeNull();
			expect(await cashflowRepo.deleteCashflowEntry(mallory.id, created.id, db)).toBe(false);
		});
	});

	describe('numeric precision', () => {
		it('round-trips an exact decimal without float drift', async () => {
			const exact = '12345678.12345678';
			const asset = await assetsRepo.createAsset(
				alice.id,
				{
					name: 'Precision check',
					assetType: 'other',
					accountId: null,
					symbol: null,
					currency: 'THB',
					quantity: '1',
					unitPrice: '0',
					manualValue: exact,
					acquisitionCost: null,
					valuationDate: '2026-08-01',
					notes: null
				},
				db
			);

			const read = await assetsRepo.findAsset(alice.id, asset.id, db);
			expect(read?.manualValue).toBe(exact);
		});

		it('keeps twelve decimal places on a quantity', async () => {
			const quantity = '0.123456789012';
			const asset = await assetsRepo.createAsset(
				alice.id,
				{
					name: 'Fractional crypto',
					assetType: 'crypto',
					accountId: null,
					symbol: 'BTC',
					currency: 'USD',
					quantity,
					unitPrice: '100000',
					manualValue: null,
					acquisitionCost: null,
					valuationDate: '2026-08-01',
					notes: null
				},
				db
			);

			const read = await assetsRepo.findAsset(alice.id, asset.id, db);
			expect(read?.quantity).toBe(quantity);
		});
	});

	describe('snapshots', () => {
		it('upserts one row per user per date', async () => {
			const values = {
				snapshotDate: '2026-08-01',
				baseCurrency: 'THB',
				totalAssets: '1000000.00000000',
				totalLiabilities: '400000.00000000',
				netWorth: '600000.00000000',
				liquidAssets: '100000.00000000',
				investmentAssets: '200000.00000000'
			};
			await snapshotsRepo.upsertSnapshot(alice.id, values, db);
			await snapshotsRepo.upsertSnapshot(alice.id, { ...values, netWorth: '700000.00000000' }, db);

			const all = await snapshotsRepo.listSnapshots(alice.id, { since: '2026-08-01' }, db);
			const forDate = all.filter((s) => s.snapshotDate === '2026-08-01');
			expect(forDate).toHaveLength(1);
			expect(forDate[0].netWorth).toBe('700000.00000000');
		});

		it('does not leak snapshots across users', async () => {
			expect(await snapshotsRepo.latestSnapshot(mallory.id, db)).toBeNull();
		});
	});

	describe('settings', () => {
		it('returns documented defaults for a user with no row', async () => {
			const settings = await getSettings('does-not-exist', db);
			expect(settings.baseCurrency).toBe('THB');
			expect(settings.locale).toBe('th-TH');
		});

		it('updates only the calling user’s settings', async () => {
			await upsertSettings(alice.id, { baseCurrency: 'USD' }, db);
			expect((await getSettings(alice.id, db)).baseCurrency).toBe('USD');
			expect((await getSettings(mallory.id, db)).baseCurrency).toBe('THB');
			await upsertSettings(alice.id, { baseCurrency: 'THB' }, db);
		});
	});

	describe('transactions', () => {
		it('scopes trade history to the owner', async () => {
			const account = await accountsRepo.createAccount(
				alice.id,
				{
					name: 'Alice broker',
					accountType: 'brokerage',
					institution: null,
					currency: 'USD',
					description: null,
					isActive: true
				},
				db
			);

			const created = await transactionsRepo.createTransaction(
				alice.id,
				{
					accountId: account.id,
					assetId: null,
					transactionType: 'deposit',
					transactionDate: '2026-08-01',
					quantity: null,
					unitPrice: null,
					grossAmount: '1000',
					feeAmount: '0',
					taxAmount: '0',
					currency: 'USD',
					exchangeRate: null,
					notes: null
				},
				db
			);

			expect(await transactionsRepo.findTransaction(mallory.id, created.id, db)).toBeNull();
			expect(await transactionsRepo.deleteTransaction(mallory.id, created.id, db)).toBe(false);
			expect(await transactionsRepo.listTransactions(mallory.id, {}, db)).toHaveLength(0);
		});
	});
});
