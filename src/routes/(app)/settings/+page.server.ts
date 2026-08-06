import { fail } from '@sveltejs/kit';
import { exchangeRateInputSchema } from '$lib/schemas/financial';
import { settingsInputSchema } from '$lib/schemas/settings';
import { updateProfileSchema } from '$lib/schemas/auth';
import { requireUser, requireUserOrFail } from '$lib/server/authorization';
import { getSettings, upsertSettings } from '$lib/server/repositories/settings';
import { deleteRate, listRates, upsertRate } from '$lib/server/repositories/rates';
import { shellSummary } from '$lib/server/repositories/summary';
import { listImportBatches } from '$lib/server/repositories/imports';
import { latestSnapshot } from '$lib/server/repositories/snapshots';
import { attempt, ok, parseForm } from '$lib/server/services/result';
import { getAuth } from '$lib/server/auth';
import { idSchema } from '$lib/schemas/common';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const [settings, rates, summary, imports, snapshot] = await Promise.all([
		getSettings(user.id),
		listRates(),
		shellSummary(user.id),
		listImportBatches(user.id, 5),
		latestSnapshot(user.id)
	]);

	return {
		settings,
		rates: rates.map((r) => ({
			id: r.id,
			baseCurrency: r.baseCurrency,
			quoteCurrency: r.quoteCurrency,
			rate: r.rate,
			rateDate: r.rateDate,
			source: r.source
		})),
		summary,
		imports: imports.map((b) => ({
			id: b.id,
			fileName: b.fileName,
			kind: b.kind,
			importedCount: b.importedCount,
			createdAt: b.createdAt.toISOString().slice(0, 10)
		})),
		lastSnapshot: snapshot?.snapshotDate ?? null,
		profile: { name: user.name, email: user.email }
	};
};

export const actions: Actions = {
	preferences: async (event) => {
		const user = requireUserOrFail(event);
		const parsed = parseForm(settingsInputSchema, await event.request.formData());
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'settings.update', route: '/settings', user: user.id, values: parsed.values },
			() => upsertSettings(user.id, parsed.value)
		);
		if (!result.ok) return fail(500, result.failure);
		return ok('Preferences saved.');
	},

	profile: async (event) => {
		const user = requireUserOrFail(event);
		const parsed = parseForm(updateProfileSchema, await event.request.formData());
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'profile.update', route: '/settings', user: user.id, values: parsed.values },
			() =>
				getAuth().api.updateUser({
					body: { name: parsed.value.name },
					headers: event.request.headers
				})
		);
		if (!result.ok) return fail(500, result.failure);
		return ok('Profile updated.');
	},

	addRate: async (event) => {
		requireUserOrFail(event);
		const parsed = parseForm(exchangeRateInputSchema, await event.request.formData());
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt(
			{ event: 'rate.upsert', route: '/settings', values: parsed.values },
			() => upsertRate(parsed.value)
		);
		if (!result.ok) return fail(500, result.failure);
		return ok('Exchange rate saved.');
	},

	deleteRate: async (event) => {
		requireUserOrFail(event);
		const parsed = parseForm(z.object({ id: idSchema }), await event.request.formData());
		if (!parsed.ok) return fail(400, parsed.failure);

		const result = await attempt({ event: 'rate.delete', route: '/settings' }, () =>
			deleteRate(parsed.value.id)
		);
		if (!result.ok) return fail(500, result.failure);
		return ok('Exchange rate removed.');
	}
};
