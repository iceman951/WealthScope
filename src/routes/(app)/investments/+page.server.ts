import { fail } from '@sveltejs/kit';
import {
	REBALANCE_THRESHOLD_PP,
	investmentIncome,
	realisedGains,
	totalReturn
} from '$engine/returns';
import { deleteSchema, priceInputSchema, transactionInputSchema } from '$lib/schemas/financial';
import { requireUser, requireUserOrFail } from '$lib/server/authorization';
import { listAccounts } from '$lib/server/repositories/accounts';
import { loadAnalysis, loadTransactionHistory } from '$lib/server/services/portfolio';
import * as records from '$lib/server/services/records';
import { attempt, ok, parseForm } from '$lib/server/services/result';
import { listTransactions } from '$lib/server/repositories/transactions';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);

	const [analysis, accounts, transactions, history] = await Promise.all([
		loadAnalysis(user.id),
		listAccounts(user.id),
		listTransactions(user.id, { limit: 50 }),
		loadTransactionHistory(user.id)
	]);

	const { metrics, settings } = analysis;
	const realised = realisedGains(history);
	const income = investmentIncome(history);
	const total = totalReturn(metrics.portfolio, realised, income);

	return {
		portfolio: {
			marketValue: metrics.portfolio.marketValue,
			costBasis: metrics.portfolio.costBasis,
			costBasisIncomplete: metrics.portfolio.costBasisIncomplete,
			unrealisedGain: metrics.portfolio.unrealisedGain,
			unrealisedReturn: metrics.portfolio.unrealisedReturn
		},
		holdings: metrics.portfolio.holdings,
		topWeight: metrics.portfolioConcentration.top1Share,
		sleeves: metrics.sleeves.map((s) => ({
			...s,
			drifted: s.drift !== null && s.drift.abs().greaterThan(REBALANCE_THRESHOLD_PP)
		})),
		realised: {
			gain: realised.realisedGain,
			proceeds: realised.proceeds,
			costOfSales: realised.costOfSales,
			unmatchedSales: realised.unmatchedSales
		},
		income,
		total,
		transactions: transactions.map((tx) => ({
			id: tx.id,
			date: tx.transactionDate,
			type: tx.transactionType,
			assetId: tx.assetId,
			assetName: tx.assetName,
			assetSymbol: tx.assetSymbol,
			accountId: tx.accountId,
			accountName: tx.accountName,
			quantity: tx.quantity,
			unitPrice: tx.unitPrice,
			grossAmount: tx.grossAmount,
			feeAmount: tx.feeAmount,
			taxAmount: tx.taxAmount,
			currency: tx.currency
		})),
		accounts: accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency })),
		holdingOptions: metrics.portfolio.holdings.map((h) => ({
			value: h.assetId,
			label: h.symbol ? `${h.symbol} — ${h.name}` : h.name
		})),
		baseCurrency: settings.baseCurrency,
		today: analysis.asOf
	};
};

export const actions: Actions = {
	createTransaction: async (event) => {
		const user = requireUserOrFail(event);
		const parsed = parseForm(transactionInputSchema, await event.request.formData());
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'transaction.create', route: '/investments', user: user.id, values: parsed.values },
			() => records.createTransaction(user.id, parsed.value)
		);
		if (!result.ok) return fail(500, result.failure);
		return ok('Transaction recorded.');
	},

	deleteTransaction: async (event) => {
		const user = requireUserOrFail(event);
		const parsed = parseForm(deleteSchema, await event.request.formData());
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'transaction.delete', route: '/investments', user: user.id },
			() => records.deleteTransaction(user.id, parsed.value.id)
		);
		if (!result.ok) return fail(500, result.failure);
		return ok('Transaction removed.');
	},

	recordPrice: async (event) => {
		const user = requireUserOrFail(event);
		const parsed = parseForm(priceInputSchema, await event.request.formData());
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'price.record', route: '/investments', user: user.id, values: parsed.values },
			() => records.recordPrice(user.id, parsed.value)
		);
		if (!result.ok) return fail(500, result.failure);
		return ok('Price recorded. The holding has been revalued.');
	}
};
