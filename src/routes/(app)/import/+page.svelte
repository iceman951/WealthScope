<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$components/base/Button.svelte';
	import StatusTag from '$components/base/StatusTag.svelte';
	import ErrorMessage from '$components/feedback/ErrorMessage.svelte';
	import LoadingSkeleton from '$components/feedback/LoadingSkeleton.svelte';
	import { showToast } from '$lib/stores/toast.svelte';
	import type { ImportKind } from '$lib/types/domain';
	import type { ActionData, PageData } from './$types';

	/**
	 * Three steps: choose and read the file, map its columns, review every row and
	 * commit. The browser's parse is a preview — the server re-validates the same
	 * bytes before anything is written, inside one transaction.
	 */

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// The URL's kind seeds the starting tab; the user may switch it afterwards.
	// svelte-ignore state_referenced_locally
	let kind = $state<ImportKind>(data.kind);
	let csvText = $state('');
	let fileName = $state('');
	let dragging = $state(false);
	let parsing = $state(false);
	let submitting = $state(false);
	let mapping = $state<Record<string, string | null>>({});
	let headers = $state<string[]>([]);
	let workerError = $state<string | null>(null);
	let previewStep = $state<'choose' | 'map' | 'review'>('choose');

	const definition = $derived(data.definitions.find((d) => d.kind === kind) ?? data.definitions[0]);
	// The two actions return different payloads; narrow before reading either.
	const preview = $derived(
		form?.success === true && form.data && 'preview' in form.data ? form.data.preview : undefined
	);
	const formErrors = $derived(form?.success === false ? form.errors._form?.join(' ') : undefined);

	$effect(() => {
		if (form?.success === true && form.data && 'imported' in form.data) {
			showToast(form.message);
			previewStep = 'choose';
			csvText = '';
			fileName = '';
			headers = [];
		}
	});

	$effect(() => {
		if (preview) {
			headers = preview.headers;
			mapping = { ...preview.mapping };
			previewStep = 'review';
		}
	});

	/**
	 * Large files are parsed off the main thread. The worker only reads headers and
	 * a sample here; the authoritative validation is the server's.
	 */
	async function parseInWorker(text: string) {
		parsing = true;
		workerError = null;
		try {
			const worker = new Worker(new URL('$lib/workers/csv-parser.worker.ts', import.meta.url), {
				type: 'module'
			});
			const result = await new Promise<{ headers: string[]; rowCount: number; error?: string }>(
				(resolve) => {
					worker.onmessage = (event) => {
						const response = event.data;
						if (response.type === 'parsed') {
							resolve({ headers: response.headers, rowCount: response.rowCount });
						} else {
							resolve({ headers: [], rowCount: 0, error: response.message });
						}
					};
					worker.onerror = () =>
						resolve({ headers: [], rowCount: 0, error: 'The file could not be read.' });
					worker.postMessage({ type: 'parse', text });
				}
			);
			worker.terminate();

			if (result.error) {
				workerError = result.error;
				return;
			}
			headers = result.headers;
			previewStep = 'map';
		} catch {
			// Worker unavailable (old browser, blocked): the server still parses on
			// submit, so this degrades to "press Preview".
			workerError =
				'Your browser could not parse the file locally. Press Preview and the server will read it.';
			previewStep = 'map';
		} finally {
			parsing = false;
		}
	}

	async function onFile(file: File) {
		if (file.size > data.maxBytes) {
			workerError = `Files are limited to ${Math.round(data.maxBytes / 1024 / 1024)} MB.`;
			return;
		}
		fileName = file.name;
		csvText = await file.text();
		await parseInWorker(csvText);
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		const file = event.dataTransfer?.files?.[0];
		if (file) void onFile(file);
	}

	function onInputChange(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (file) void onFile(file);
	}

	function errorEntries(errors: Record<string, string[]>): [string, string[]][] {
		return Object.entries(errors);
	}

	function templateHref(): string {
		const header = definition.template.join(',');
		return `data:text/csv;charset=utf-8,${encodeURIComponent(`${header}\n`)}`;
	}
</script>

<div class="ws-filterbar">
	{#each data.definitions as option (option.kind)}
		<button
			type="button"
			class="ws-chip"
			aria-pressed={kind === option.kind}
			onclick={() => {
				kind = option.kind as ImportKind;
				previewStep = 'choose';
				headers = [];
				csvText = '';
				fileName = '';
			}}
		>
			{option.label}
		</button>
	{/each}
	<div class="ws-row ws-row--end">
		<a class="btn btn-secondary" href={templateHref()} download="wealthscope-{kind}-template.csv">
			Download template
		</a>
	</div>
</div>

<div class="ws-grid ws-grid--flush ws-grid--side">
	<div class="ws-pad">
		<h4>{definition.label}</h4>
		<p class="text-muted small">{definition.description}</p>

		{#if kind === 'transactions' && !data.hasAccounts}
			<ErrorMessage
				tone="warning"
				message="Transactions must belong to an account, and this account has none yet. Create one first — the CSV's account column is matched against the account names you have."
			/>
		{/if}

		{#if formErrors}
			<ErrorMessage message={formErrors} code={form?.success === false ? form.code : undefined} />
		{/if}
		{#if workerError}
			<ErrorMessage tone="warning" message={workerError} />
		{/if}

		<form
			method="POST"
			action="?/preview"
			enctype="multipart/form-data"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update({ reset: false });
					submitting = false;
				};
			}}
		>
			<input type="hidden" name="kind" value={kind} />
			<input type="hidden" name="csv" value={csvText} />
			<input type="hidden" name="mapping" value={JSON.stringify(mapping)} />

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="dropzone"
				class:dragging
				ondragover={(e) => {
					e.preventDefault();
					dragging = true;
				}}
				ondragleave={() => (dragging = false)}
				ondrop={onDrop}
			>
				<label class="drop-label" for="csv-file">
					<span class="drop-title">Drop a CSV here, or choose a file</span>
					<span class="text-muted tiny">
						Up to {Math.round(data.maxBytes / 1024 / 1024)} MB. The file is read in your browser first,
						then re-checked on the server.
					</span>
				</label>
				<input
					id="csv-file"
					name="file"
					type="file"
					accept=".csv,text/csv"
					onchange={onInputChange}
				/>
				{#if fileName}
					<p class="chosen">
						<StatusTag>{fileName}</StatusTag>
						{#if headers.length > 0}
							<span class="text-muted tiny">{headers.length} columns detected</span>
						{/if}
					</p>
				{/if}
			</div>

			<details class="paste">
				<summary>Or paste rows</summary>
				<label class="visually-hidden" for="csv-paste">CSV rows</label>
				<textarea
					id="csv-paste"
					class="input"
					rows="6"
					placeholder={definition.template.join(',')}
					bind:value={csvText}
					oninput={() => {
						fileName = fileName || 'pasted.csv';
					}}
				></textarea>
			</details>

			{#if parsing}
				<LoadingSkeleton variant="text" rows={2} label="Reading the file" />
			{/if}

			{#if previewStep !== 'choose' && headers.length > 0}
				<fieldset class="mapping">
					<legend>Map columns</legend>
					{#each definition.fields as field (field.key)}
						<div class="map-row">
							<label for="map-{field.key}">
								{field.label}{#if field.required}<span aria-hidden="true"> *</span>{/if}
								{#if field.hint}<span class="text-muted tiny block">{field.hint}</span>{/if}
							</label>
							<select
								id="map-{field.key}"
								class="input"
								value={mapping[field.key] ?? ''}
								onchange={(e) =>
									(mapping = {
										...mapping,
										[field.key]: (e.currentTarget as HTMLSelectElement).value || null
									})}
							>
								<option value="">Not mapped</option>
								{#each headers as header (header)}
									<option value={header}>{header}</option>
								{/each}
							</select>
						</div>
					{/each}
				</fieldset>
			{/if}

			<Button
				variant="secondary"
				type="submit"
				block
				pending={submitting}
				pendingLabel="Checking…"
				disabled={!csvText}
			>
				Preview &amp; validate
			</Button>
		</form>
	</div>

	<div class="ws-pad ws-scroll-x">
		{#if !preview}
			<h5>How the import works</h5>
			<ol class="steps">
				<li>
					<strong>Read.</strong> The file is parsed in a Web Worker so the page stays responsive.
				</li>
				<li><strong>Map.</strong> Columns are guessed from their headers; you confirm them.</li>
				<li>
					<strong>Validate.</strong> Every row is checked against the same schema the forms use. Bad rows
					are reported with the reason, never silently dropped.
				</li>
				<li>
					<strong>Commit.</strong> Accepted rows are written inside one transaction. If anything fails,
					the whole import rolls back and nothing is saved.
				</li>
			</ol>
			<p class="text-muted tiny">
				The file itself is never stored. Only its name, size and a content hash are recorded, so a
				repeat import can be flagged.
			</p>

			{#if data.history.length > 0}
				<div class="hr"></div>
				<h5>Recent imports</h5>
				<table class="table">
					<caption class="visually-hidden">Import history</caption>
					<thead>
						<tr>
							<th scope="col">File</th>
							<th scope="col">Kind</th>
							<th scope="col" class="num">Imported</th>
							<th scope="col">Status</th>
						</tr>
					</thead>
					<tbody>
						{#each data.history as batch (batch.id)}
							<tr>
								<td>
									<span class="name">{batch.fileName}</span>
									<span class="text-muted tiny">{batch.createdAt}</span>
								</td>
								<td>{batch.kind}</td>
								<td class="num">{batch.importedCount} / {batch.rowCount}</td>
								<td>
									<StatusTag tone={batch.status === 'completed' ? 'neutral' : 'accent'}>
										{batch.status}
									</StatusTag>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		{:else}
			<h5>Review</h5>

			{#if preview.previousImport}
				<ErrorMessage
					tone="warning"
					message="A file with identical contents was imported on {preview.previousImport
						.importedAt} as “{preview.previousImport.fileName}”. Importing again will add the rows a
					second time."
				/>
			{/if}

			{#if preview.missingRequired.length > 0}
				<ErrorMessage
					message="Map these columns before importing: {preview.missingRequired.join(', ')}."
				/>
			{/if}

			<div class="counts">
				<div>
					<div class="ws-kicker">Rows read</div>
					<div class="ws-value ws-value--fixed">{preview.rowCount}</div>
				</div>
				<div>
					<div class="ws-kicker">Will import</div>
					<div class="ws-value ws-value--fixed">{preview.validCount}</div>
				</div>
				<div>
					<div class="ws-kicker">Rejected</div>
					<div class="ws-value ws-value--fixed">{preview.rejectedCount}</div>
				</div>
			</div>

			{#if preview.rejectedCount > 0}
				<h5 class="sub">Rejected rows</h5>
				<table class="table">
					<caption class="visually-hidden">Rows that failed validation</caption>
					<thead>
						<tr><th scope="col" class="num">Line</th><th scope="col">Why</th></tr>
					</thead>
					<tbody>
						{#each preview.rejected as row (row.rowNumber)}
							<tr>
								<td class="num">{row.rowNumber}</td>
								<td>
									{#each errorEntries(row.errors) as [field, messages] (field)}
										<span class="err"><strong>{field}</strong>: {messages.join(' ')}</span>
									{/each}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				{#if preview.rejectedCount > preview.rejected.length}
					<p class="text-muted tiny">
						Showing the first {preview.rejected.length} of {preview.rejectedCount} rejections.
					</p>
				{/if}
			{/if}

			{#if preview.validCount > 0}
				<h5 class="sub">Preview of what will be written</h5>
				<table class="table">
					<caption class="visually-hidden">Sample of rows that will be imported</caption>
					<thead>
						<tr>
							{#each Object.keys(preview.sample[0] ?? {}) as column (column)}
								<th scope="col">{column}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each preview.sample as row, i (i)}
							<tr>
								{#each Object.values(row) as cell, j (j)}
									<td>{cell === null || cell === undefined ? '—' : String(cell)}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			<form
				method="POST"
				action="?/commit"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update({ reset: false });
						submitting = false;
					};
				}}
			>
				<input type="hidden" name="kind" value={kind} />
				<input type="hidden" name="csv" value={csvText} />
				<input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
				<input type="hidden" name="fileName" value={fileName} />
				<div class="commit-actions">
					<Button
						variant="secondary"
						onclick={() => {
							previewStep = 'map';
						}}
					>
						Change mapping
					</Button>
					<Button
						variant="primary"
						type="submit"
						pending={submitting}
						pendingLabel="Importing…"
						disabled={preview.validCount === 0 || preview.missingRequired.length > 0}
					>
						Import {preview.validCount}
						{preview.validCount === 1 ? 'row' : 'rows'}
					</Button>
				</div>
			</form>
		{/if}
	</div>
</div>

<style>
	h4 {
		margin: 0 0 var(--space-2);
	}
	h5 {
		margin: 0 0 var(--space-3);
	}
	h5.sub {
		margin-top: var(--space-6);
	}
	.small {
		font-size: 12.5px;
	}
	.tiny {
		font-size: 11.5px;
	}
	.block {
		display: block;
	}
	.dropzone {
		border: 2px dashed var(--color-divider);
		padding: var(--space-6) var(--space-4);
		margin: var(--space-4) 0;
		text-align: left;
	}
	.dropzone.dragging {
		border-color: var(--color-accent);
		background: var(--color-accent-100);
	}
	.drop-label {
		display: block;
		cursor: pointer;
	}
	.drop-title {
		display: block;
		font-family: var(--font-heading);
		font-weight: 800;
		font-size: 15px;
		margin-bottom: 4px;
	}
	.dropzone input[type='file'] {
		margin-top: var(--space-3);
		font-size: 13px;
	}
	.chosen {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: var(--space-3) 0 0;
		flex-wrap: wrap;
	}
	.paste {
		margin-bottom: var(--space-4);
	}
	.paste summary {
		cursor: pointer;
		font-size: 13px;
		margin-bottom: var(--space-2);
	}
	.mapping {
		border: 2px solid var(--color-divider);
		padding: var(--space-4);
		margin-bottom: var(--space-4);
	}
	.mapping legend {
		font-family: var(--font-heading);
		font-weight: 800;
		font-size: 13px;
		padding: 0 var(--space-2);
	}
	.map-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-3);
		align-items: start;
		padding: 6px 0;
	}
	.map-row label {
		font-size: 12px;
	}
	.steps {
		font-size: 13px;
		padding-left: 1.1rem;
	}
	.steps li {
		margin-bottom: var(--space-2);
	}
	.counts {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-4);
		border-top: 2px solid var(--color-divider);
		border-bottom: 2px solid var(--color-divider);
		padding: var(--space-3) 0;
		margin: var(--space-4) 0;
	}
	.err {
		display: block;
		font-size: 12px;
	}
	.name {
		display: block;
		font-weight: 600;
	}
	.commit-actions {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-4);
		flex-wrap: wrap;
	}
	@media (max-width: 560px) {
		.map-row {
			grid-template-columns: 1fr;
		}
	}
</style>
