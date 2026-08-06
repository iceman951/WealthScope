import { error } from '@sveltejs/kit';
import { csvResponse } from '$lib/exporters/csv';
import { requireUserOrFail } from '$lib/server/authorization';
import { buildCsv, exportFilename, type ExportKind } from '$lib/server/services/export';
import { today } from '$lib/server/services/portfolio';
import { log } from '$lib/server/security/logging';
import type { RequestHandler } from './$types';

const KINDS: readonly ExportKind[] = [
	'assets',
	'liabilities',
	'cashflow',
	'transactions',
	'snapshots'
];

/**
 * A file download, so this is an endpoint rather than a form action. The body is
 * the authenticated user's own data and nothing else.
 */
export const GET: RequestHandler = async (event) => {
	const user = requireUserOrFail(event);

	const requested = event.url.searchParams.get('kind') ?? 'assets';
	if (!KINDS.includes(requested as ExportKind)) {
		error(400, 'Unknown export type.');
	}
	const kind = requested as ExportKind;

	const body = await buildCsv(user.id, kind);
	// Row counts are safe to log; the rows themselves never are.
	log('info', { event: 'export.csv', user: user.id, reason: kind });

	return csvResponse(exportFilename(kind, today()), body);
};
