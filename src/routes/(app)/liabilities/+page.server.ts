import { fail } from '@sveltejs/kit';
import { amortise, avalanchePlan, formatTerm, rateBarFraction } from '$engine/debt';
import { deleteSchema, liabilityInputSchema } from '$lib/schemas/financial';
import { requireUser, requireUserOrFail } from '$lib/server/authorization';
import { listAccounts } from '$lib/server/repositories/accounts';
import { listLiabilities } from '$lib/server/repositories/liabilities';
import { loadAnalysis } from '$lib/server/services/portfolio';
import * as records from '$lib/server/services/records';
import { attempt, ok, parseForm } from '$lib/server/services/result';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const [analysis, accounts, stored] = await Promise.all([
		loadAnalysis(user.id),
		listAccounts(user.id),
		listLiabilities(user.id)
	]);
	const { metrics, settings } = analysis;

	// The engine result drives the table; the stored row drives the edit form, so
	// the form always shows what is actually persisted rather than a converted value.
	const byId = new Map(stored.map((row) => [row.id, row]));

	const rows = metrics.debt.positions.map((position) => {
		const source = byId.get(position.id);
		const schedule = amortise(position.balance, position.annualRate, position.monthlyPayment);
		return {
			id: position.id,
			name: position.name,
			typeLabel: position.typeLabel,
			group: position.group,
			balance: position.balance,
			annualRate: position.annualRate,
			monthlyPayment: position.monthlyPayment,
			annualInterest: position.annualInterest,
			term: formatTerm(schedule.monthsToPayoff, schedule.neverAmortises),
			totalInterest: schedule.totalInterest,
			neverAmortises: schedule.neverAmortises,
			form: {
				liabilityType: source?.liabilityType ?? 'other',
				accountId: source?.accountId ?? '',
				currency: source?.currency ?? settings.baseCurrency,
				originalPrincipal: source?.originalPrincipal ?? '0',
				outstandingBalance: source?.outstandingBalance ?? '0',
				interestRate: source?.interestRate ?? '0',
				minimumPayment: source?.minimumPayment ?? '',
				monthlyPayment: source?.monthlyPayment ?? '',
				startDate: source?.startDate ?? '',
				maturityDate: source?.maturityDate ?? '',
				notes: source?.notes ?? ''
			}
		};
	});

	const payoff = avalanchePlan(metrics.debt.positions).map((step) => ({
		id: step.id,
		name: step.name,
		rank: step.rank,
		annualRate: step.annualRate,
		balance: step.balance,
		annualInterest: step.annualInterest,
		clearedInMonth: step.clearedInMonth,
		barPercent: rateBarFraction(step.annualRate),
		expensive: step.annualRate.greaterThan(6)
	}));

	return {
		rows,
		payoff,
		debt: {
			totalDebt: metrics.debt.totalDebt,
			monthlyDebtPayment: metrics.debt.monthlyDebtPayment,
			debtServiceRatio: metrics.debt.debtServiceRatio,
			debtToAssets: metrics.debt.debtToAssets,
			weightedAverageRate: metrics.debt.weightedAverageRate,
			annualInterest: metrics.debt.annualInterest
		},
		monthlyIncome: metrics.cashflow.monthlyIncome,
		baseCurrency: settings.baseCurrency,
		accounts: accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency })),
		today: analysis.asOf
	};
};

export const actions: Actions = {
	create: async (event) => {
		const user = requireUserOrFail(event);
		const parsed = parseForm(liabilityInputSchema, await event.request.formData());
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'liability.create', route: '/liabilities', user: user.id, values: parsed.values },
			() => records.createLiability(user.id, parsed.value)
		);
		if (!result.ok) return fail(500, result.failure);
		return ok('Liability saved.');
	},

	update: async (event) => {
		const user = requireUserOrFail(event);
		const data = await event.request.formData();
		const id = String(data.get('id') ?? '');
		const parsed = parseForm(liabilityInputSchema, data);
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'liability.update', route: '/liabilities', user: user.id, values: parsed.values },
			() => records.updateLiability(user.id, id, parsed.value)
		);
		if (!result.ok) return fail(500, result.failure);
		return ok('Liability updated.');
	},

	delete: async (event) => {
		const user = requireUserOrFail(event);
		const parsed = parseForm(deleteSchema, await event.request.formData());
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'liability.delete', route: '/liabilities', user: user.id },
			() => records.deleteLiability(user.id, parsed.value.id)
		);
		if (!result.ok) return fail(500, result.failure);
		return ok('Liability removed.');
	}
};
