import { error } from '@sveltejs/kit';
import type { AssetType } from '$lib/types/domain';
import type {
	AccountInput,
	AssetInputPayload,
	CashflowInputPayload,
	GoalInputPayload,
	LiabilityInputPayload,
	TransactionInputPayload
} from '$lib/schemas/financial';
import * as accountsRepo from '../repositories/accounts';
import * as assetsRepo from '../repositories/assets';
import * as cashflowRepo from '../repositories/cashflow';
import * as goalsRepo from '../repositories/goals';
import * as liabilitiesRepo from '../repositories/liabilities';
import * as transactionsRepo from '../repositories/transactions';

/**
 * Record services.
 *
 * Each function takes the user id resolved from the session and passes it into
 * every repository call, so a record belonging to someone else is simply not
 * found. Business rules that span repositories live here, not in a route.
 */

/* ── accounts ─────────────────────────────────────────────────────────────── */

export function listAccounts(userId: string) {
	return accountsRepo.listAccountsWithUsage(userId);
}

export function createAccount(userId: string, input: AccountInput) {
	return accountsRepo.createAccount(userId, input);
}

export async function updateAccount(userId: string, id: string, input: AccountInput) {
	const updated = await accountsRepo.updateAccount(userId, id, input);
	if (!updated) error(404, 'That account was not found.');
	return updated;
}

export async function deleteAccount(userId: string, id: string) {
	const account = await accountsRepo.findAccount(userId, id);
	if (!account) error(404, 'That account was not found.');

	// Transactions reference their account with ON DELETE RESTRICT: losing the
	// wrapper must not silently erase the trade history inside it.
	const transactions = await transactionsRepo.listTransactions(userId, { accountId: id, limit: 1 });
	if (transactions.length > 0) {
		error(
			409,
			'This account still has transactions. Delete or move them first — removing the account would take their history with it.'
		);
	}

	await accountsRepo.deleteAccount(userId, id);
}

/* ── assets ───────────────────────────────────────────────────────────────── */

export function listAssets(userId: string, assetType?: AssetType | null) {
	return assetsRepo.listAssets(userId, assetType ? { assetTypes: [assetType] } : {});
}

export function listInvestments(userId: string) {
	return assetsRepo.listInvestments(userId);
}

/** Validates that a referenced account is one this user owns before writing. */
async function assertAccountOwned(userId: string, accountId: string | null) {
	if (!accountId) return;
	const account = await accountsRepo.findAccount(userId, accountId);
	if (!account) error(400, 'That account does not exist.');
}

export async function createAsset(userId: string, input: AssetInputPayload) {
	await assertAccountOwned(userId, input.accountId);
	return assetsRepo.createAsset(userId, input);
}

export async function updateAsset(userId: string, id: string, input: AssetInputPayload) {
	await assertAccountOwned(userId, input.accountId);
	const updated = await assetsRepo.updateAsset(userId, id, input);
	if (!updated) error(404, 'That asset was not found.');
	return updated;
}

export async function deleteAsset(userId: string, id: string) {
	const asset = await assetsRepo.findAsset(userId, id);
	if (!asset) error(404, 'That asset was not found.');

	const transactions = await transactionsRepo.listTransactions(userId, { assetId: id, limit: 1 });
	if (transactions.length > 0) {
		error(
			409,
			'This holding still has transactions. Delete them first — cost basis and realised gains are computed from that history.'
		);
	}

	await assetsRepo.deleteAsset(userId, id);
}

export async function recordPrice(
	userId: string,
	input: { assetId: string; price: string; currency: string; priceDate: string }
) {
	const result = await assetsRepo.recordPrice(userId, input);
	if (!result) error(404, 'That holding was not found.');
	return result;
}

/* ── liabilities ──────────────────────────────────────────────────────────── */

export function listLiabilities(userId: string) {
	return liabilitiesRepo.listLiabilities(userId);
}

export async function createLiability(userId: string, input: LiabilityInputPayload) {
	await assertAccountOwned(userId, input.accountId);
	return liabilitiesRepo.createLiability(userId, input);
}

export async function updateLiability(userId: string, id: string, input: LiabilityInputPayload) {
	await assertAccountOwned(userId, input.accountId);
	const updated = await liabilitiesRepo.updateLiability(userId, id, input);
	if (!updated) error(404, 'That liability was not found.');
	return updated;
}

export async function deleteLiability(userId: string, id: string) {
	const removed = await liabilitiesRepo.deleteLiability(userId, id);
	if (!removed) error(404, 'That liability was not found.');
}

/* ── cash flow ────────────────────────────────────────────────────────────── */

export function listCashflow(userId: string) {
	return cashflowRepo.listCashflowEntries(userId);
}

export function createCashflowEntry(userId: string, input: CashflowInputPayload) {
	return cashflowRepo.createCashflowEntry(userId, input);
}

export async function updateCashflowEntry(userId: string, id: string, input: CashflowInputPayload) {
	const updated = await cashflowRepo.updateCashflowEntry(userId, id, input);
	if (!updated) error(404, 'That entry was not found.');
	return updated;
}

export async function deleteCashflowEntry(userId: string, id: string) {
	const removed = await cashflowRepo.deleteCashflowEntry(userId, id);
	if (!removed) error(404, 'That entry was not found.');
}

/* ── transactions ─────────────────────────────────────────────────────────── */

export function listTransactions(
	userId: string,
	options: { assetId?: string; limit?: number } = {}
) {
	return transactionsRepo.listTransactions(userId, options);
}

export async function createTransaction(userId: string, input: TransactionInputPayload) {
	await assertAccountOwned(userId, input.accountId);
	if (input.assetId) {
		const asset = await assetsRepo.findAsset(userId, input.assetId);
		if (!asset) error(400, 'That holding does not exist.');
	}
	return transactionsRepo.createTransaction(userId, input);
}

export async function updateTransaction(
	userId: string,
	id: string,
	input: TransactionInputPayload
) {
	await assertAccountOwned(userId, input.accountId);
	const updated = await transactionsRepo.updateTransaction(userId, id, input);
	if (!updated) error(404, 'That transaction was not found.');
	return updated;
}

export async function deleteTransaction(userId: string, id: string) {
	const removed = await transactionsRepo.deleteTransaction(userId, id);
	if (!removed) error(404, 'That transaction was not found.');
}

/* ── goals ────────────────────────────────────────────────────────────────── */

export function listGoals(userId: string) {
	return goalsRepo.listGoals(userId);
}

export function createGoal(userId: string, input: GoalInputPayload) {
	return goalsRepo.createGoal(userId, input);
}

export async function updateGoal(userId: string, id: string, input: GoalInputPayload) {
	const updated = await goalsRepo.updateGoal(userId, id, input);
	if (!updated) error(404, 'That goal was not found.');
	return updated;
}

export async function deleteGoal(userId: string, id: string) {
	const removed = await goalsRepo.deleteGoal(userId, id);
	if (!removed) error(404, 'That goal was not found.');
}
