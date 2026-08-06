import { fail } from '@sveltejs/kit';
import { accountInputSchema, deleteSchema } from '$lib/schemas/financial';
import { requireUser, requireUserOrFail } from '$lib/server/authorization';
import { getSettings } from '$lib/server/repositories/settings';
import * as records from '$lib/server/services/records';
import { attempt, ok, parseForm } from '$lib/server/services/result';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const [accounts, settings] = await Promise.all([
		records.listAccounts(user.id),
		getSettings(user.id)
	]);

	return {
		accounts: accounts.map((a) => ({
			id: a.id,
			name: a.name,
			accountType: a.accountType,
			institution: a.institution,
			currency: a.currency,
			description: a.description,
			isActive: a.isActive,
			assetCount: a.assetCount,
			liabilityCount: a.liabilityCount,
			transactionCount: a.transactionCount
		})),
		baseCurrency: settings.baseCurrency
	};
};

export const actions: Actions = {
	create: async (event) => {
		const user = requireUserOrFail(event);
		const parsed = parseForm(accountInputSchema, await event.request.formData());
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'account.create', route: '/accounts', user: user.id, values: parsed.values },
			() => records.createAccount(user.id, parsed.value)
		);
		if (!result.ok) return fail(500, result.failure);
		return ok('Account saved.');
	},

	update: async (event) => {
		const user = requireUserOrFail(event);
		const data = await event.request.formData();
		const id = String(data.get('id') ?? '');
		const parsed = parseForm(accountInputSchema, data);
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'account.update', route: '/accounts', user: user.id, values: parsed.values },
			() => records.updateAccount(user.id, id, parsed.value)
		);
		if (!result.ok) return fail(500, result.failure);
		return ok('Account updated.');
	},

	delete: async (event) => {
		const user = requireUserOrFail(event);
		const parsed = parseForm(deleteSchema, await event.request.formData());
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'account.delete', route: '/accounts', user: user.id },
			() => records.deleteAccount(user.id, parsed.value.id)
		);
		if (!result.ok) return fail(500, result.failure);
		return ok('Account removed. Records that referenced it are now unassigned.');
	}
};
