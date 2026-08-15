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
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);

	// pageBounds clamps the range but not NaN, and Math.trunc(NaN) is NaN, which
	// would reach the query as OFFSET NaN. Settle it here.
	const requestedPage = Number(event.url.searchParams.get('page'));
	const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.trunc(requestedPage) : 1;

	const [analysis, accounts, transactions, history] = await Promise.all([
		loadAnalysis(user.id),
		listAccounts(user.id),
		// The display table only.
		records.listTransactionsPaged(user.id, { page }),
		// The whole history, deliberately unbounded: FIFO cost basis is computed
		// from every lot ever opened. Paginating this would drop the oldest buys
		// and report the sells against them as unmatched.
		loadTransactionHistory(user.id)
	]);

	const { metrics, settings } = analysis;
	// The full history, never the paged display list: FIFO needs every lot, and
	// matching a sell against a truncated set would invent unmatched sales.
	const returnContext = { baseCurrency: settings.baseCurrency, rates: analysis.rates };
	const realised = realisedGains(history, returnContext);
	const income = investmentIncome(history, returnContext);
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
			unmatchedSales: realised.unmatchedSales,
			excludedTransactions: realised.excludedTransactions
		},
		income,
		total,
		pagination: {
			page: transactions.page,
			pageSize: transactions.pageSize,
			total: transactions.total
		},
		transactions: transactions.rows.map((tx) => ({
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
			currency: tx.currency,
			// Both are optional on transactionInputSchema, so an edit that does not
			// carry them writes null. They travel to the dialog to be sent back.
			exchangeRate: tx.exchangeRate,
			notes: tx.notes
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

	updateTransaction: async (event) => {
		const user = requireUserOrFail(event);
		// transactionInputSchema has no id field, so read it before parsing.
		const data = await event.request.formData();
		const id = String(data.get('id') ?? '');
		const parsed = parseForm(transactionInputSchema, data);
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'transaction.update', route: '/investments', user: user.id, values: parsed.values },
			() => records.updateTransaction(user.id, id, parsed.value)
		);
		if (!result.ok) return fail(500, result.failure);
		return ok('Transaction updated.');
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
