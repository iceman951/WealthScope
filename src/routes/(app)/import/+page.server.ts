import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { IMPORT_DEFINITIONS } from '$lib/importers/definitions';
import { MAX_CSV_BYTES } from '$lib/importers/csv';
import { enumOf } from '$lib/schemas/common';
import { requireUser, requireUserOrFail } from '$lib/server/authorization';
import { listAccounts } from '$lib/server/repositories/accounts';
import { listImportBatches } from '$lib/server/repositories/imports';
import { assertUploadAcceptable, commitImport, previewImport } from '$lib/server/services/import';
import { attempt, formError, ok } from '$lib/server/services/result';
import { consume } from '$lib/server/security/rate-limit';
import { IMPORT_KINDS, type ImportKind } from '$lib/types/domain';
import type { Actions, PageServerLoad } from './$types';

const kindSchema = enumOf(IMPORT_KINDS, 'Choose what kind of file this is');

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const requested = event.url.searchParams.get('kind');
	const kind: ImportKind =
		requested && (IMPORT_KINDS as readonly string[]).includes(requested)
			? (requested as ImportKind)
			: 'assets';

	const [batches, accounts] = await Promise.all([
		listImportBatches(user.id, 10),
		listAccounts(user.id)
	]);

	return {
		kind,
		definitions: Object.values(IMPORT_DEFINITIONS).map((definition) => ({
			kind: definition.kind,
			label: definition.label,
			description: definition.description,
			template: definition.template,
			fields: definition.fields
		})),
		maxBytes: MAX_CSV_BYTES,
		hasAccounts: accounts.length > 0,
		history: batches.map((b) => ({
			id: b.id,
			kind: b.kind,
			fileName: b.fileName,
			rowCount: b.rowCount,
			importedCount: b.importedCount,
			rejectedCount: b.rejectedCount,
			status: b.status,
			createdAt: b.createdAt.toISOString().slice(0, 10)
		}))
	};
};

/** The mapping arrives as JSON from the browser's mapping step. */
const mappingSchema = z.string().transform((raw, ctx) => {
	try {
		const parsed: unknown = JSON.parse(raw);
		const result = z.record(z.string(), z.string().nullable()).safeParse(parsed);
		if (!result.success) throw new Error('shape');
		return result.data;
	} catch {
		ctx.addIssue({ code: 'custom', message: 'The column mapping could not be read.' });
		return z.NEVER;
	}
});

async function readUpload(data: FormData): Promise<{ text: string; fileName: string } | null> {
	const file = data.get('file');
	if (file instanceof File && file.size > 0) {
		assertUploadAcceptable({ size: file.size, type: file.type, name: file.name });
		return { text: await file.text(), fileName: file.name };
	}

	const pasted = data.get('csv');
	if (typeof pasted === 'string' && pasted.trim()) {
		if (new TextEncoder().encode(pasted).length > MAX_CSV_BYTES) return null;
		return { text: pasted, fileName: 'pasted.csv' };
	}

	return null;
}

export const actions: Actions = {
	/** Parses and validates without writing anything. */
	preview: async (event) => {
		const user = requireUserOrFail(event);
		const data = await event.request.formData();

		const kind = kindSchema.safeParse(data.get('kind'));
		if (!kind.success) return fail(400, formError('Choose what kind of file this is.'));

		const upload = await readUpload(data);
		if (!upload) return fail(400, formError('Choose a CSV file, or paste some rows.'));

		const rawMapping = data.get('mapping');
		const mapping =
			typeof rawMapping === 'string' && rawMapping ? mappingSchema.safeParse(rawMapping) : null;

		const result = await attempt({ event: 'import.preview', route: '/import', user: user.id }, () =>
			previewImport(user.id, kind.data, upload.text, mapping?.success ? mapping.data : undefined)
		);
		if (!result.ok) return fail(500, result.failure);

		return ok('Preview ready.', {
			preview: result.value,
			// Round-tripped so the commit step re-validates exactly these bytes on
			// the server rather than trusting anything the browser computed.
			csv: upload.text,
			fileName: upload.fileName
		});
	},

	/** Re-validates on the server and writes every accepted row in one transaction. */
	commit: async (event) => {
		const user = requireUserOrFail(event);

		const limit = await consume('import', user.id);
		if (!limit.allowed) {
			return fail(
				429,
				formError(`Too many imports. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.`)
			);
		}

		const data = await event.request.formData();
		const kind = kindSchema.safeParse(data.get('kind'));
		if (!kind.success) return fail(400, formError('Choose what kind of file this is.'));

		const upload = await readUpload(data);
		if (!upload) return fail(400, formError('The file could not be read. Upload it again.'));

		const mapping = mappingSchema.safeParse(data.get('mapping'));
		if (!mapping.success) return fail(400, formError('The column mapping could not be read.'));

		const fileName = String(data.get('fileName') ?? upload.fileName);

		const result = await attempt({ event: 'import.commit', route: '/import', user: user.id }, () =>
			commitImport(user.id, kind.data, upload.text, mapping.data, fileName)
		);
		if (!result.ok) return fail(500, result.failure);

		const { imported, rejected, skippedDuplicates } = result.value;
		const parts = [`${imported} ${imported === 1 ? 'row' : 'rows'} imported`];
		if (rejected > 0) parts.push(`${rejected} rejected`);
		if (skippedDuplicates > 0) parts.push(`${skippedDuplicates} skipped as duplicates`);

		return ok(`${parts.join(', ')}.`, result.value);
	}
};
