import { requireUser } from '$lib/server/authorization';
import { listSnapshots } from '$lib/server/repositories/snapshots';
import { EXPORT_KINDS } from '$lib/server/services/export';
import { loadAnalysis } from '$lib/server/services/portfolio';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const [analysis, snapshots] = await Promise.all([loadAnalysis(user.id), listSnapshots(user.id)]);

	return {
		metrics: analysis.metrics,
		exportKinds: EXPORT_KINDS,
		snapshots: snapshots.map((s) => ({
			snapshotDate: s.snapshotDate,
			netWorth: s.netWorth,
			totalAssets: s.totalAssets,
			totalLiabilities: s.totalLiabilities,
			baseCurrency: s.baseCurrency
		})),
		asOf: analysis.asOf,
		userName: user.name
	};
};
