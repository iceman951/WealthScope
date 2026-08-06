import { fail } from '@sveltejs/kit';
import { trailingMonthlyFlow } from '$engine/cashflow';
import { cashflowInputSchema, deleteSchema } from '$lib/schemas/financial';
import { requireUser, requireUserOrFail } from '$lib/server/authorization';
import { listCashflowEntries, toEngineCashflow } from '$lib/server/repositories/cashflow';
import { ratesAsOf } from '$lib/server/repositories/rates';
import { loadAnalysis } from '$lib/server/services/portfolio';
import * as records from '$lib/server/services/records';
import { attempt, ok, parseForm } from '$lib/server/services/result';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const [analysis, entries] = await Promise.all([
		loadAnalysis(user.id),
		listCashflowEntries(user.id)
	]);
	const rates = await ratesAsOf(analysis.asOf);
	const { metrics, settings } = analysis;

	return {
		income: metrics.cashflow.incomeByCategory,
		expenses: metrics.cashflow.expensesByCategory,
		summary: {
			monthlyIncome: metrics.cashflow.monthlyIncome,
			monthlyExpenses: metrics.cashflow.monthlyExpenses,
			netCashflow: metrics.cashflow.netCashflow,
			savingsRate: metrics.cashflow.savingsRate,
			recurringIncome: metrics.cashflow.recurringIncome,
			recurringExpenses: metrics.cashflow.recurringExpenses,
			oneOffIncome: metrics.cashflow.oneOffIncome,
			oneOffExpenses: metrics.cashflow.oneOffExpenses
		},
		flow: trailingMonthlyFlow(
			entries.map(toEngineCashflow),
			settings.baseCurrency,
			rates,
			analysis.asOf
		),
		entries: entries.map((e) => ({
			id: e.id,
			entryType: e.entryType,
			category: e.category,
			name: e.name,
			amount: e.amount,
			currency: e.currency,
			frequency: e.frequency,
			entryDate: e.entryDate,
			endDate: e.endDate,
			isRecurring: e.isRecurring,
			notes: e.notes
		})),
		baseCurrency: settings.baseCurrency,
		today: analysis.asOf
	};
};

export const actions: Actions = {
	create: async (event) => {
		const user = requireUserOrFail(event);
		const parsed = parseForm(cashflowInputSchema, await event.request.formData());
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'cashflow.create', route: '/cashflow', user: user.id, values: parsed.values },
			() => records.createCashflowEntry(user.id, parsed.value)
		);
		if (!result.ok) return fail(500, result.failure);
		return ok('Entry saved.');
	},

	update: async (event) => {
		const user = requireUserOrFail(event);
		const data = await event.request.formData();
		const id = String(data.get('id') ?? '');
		const parsed = parseForm(cashflowInputSchema, data);
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'cashflow.update', route: '/cashflow', user: user.id, values: parsed.values },
			() => records.updateCashflowEntry(user.id, id, parsed.value)
		);
		if (!result.ok) return fail(500, result.failure);
		return ok('Entry updated.');
	},

	delete: async (event) => {
		const user = requireUserOrFail(event);
		const parsed = parseForm(deleteSchema, await event.request.formData());
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'cashflow.delete', route: '/cashflow', user: user.id },
			() => records.deleteCashflowEntry(user.id, parsed.value.id)
		);
		if (!result.ok) return fail(500, result.failure);
		return ok('Entry removed.');
	}
};
