<script lang="ts">
	import PercentageDisplay from '$components/base/PercentageDisplay.svelte';
	import EmptyState from '$components/feedback/EmptyState.svelte';
	import { getFormatters } from '$lib/stores/formatting.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const fmt = getFormatters();
	const m = $derived(data.metrics);

	let netWorth = $state(true);
	let allocation = $state(true);
	let risk = $state(true);
	let records = $state(false);

	const pdfHref = $derived(
		`/api/exports/pdf?netWorth=${netWorth}&allocation=${allocation}&risk=${risk}&records=${records}`
	);
</script>

{#if m.isEmpty}
	<EmptyState
		title="Nothing to report on"
		description="A report is a statement of the records in this account. Add an asset or import a CSV, then come back."
	>
		{#snippet actions()}
			<a class="btn btn-primary" href="/assets">Add an asset</a>
			<a class="btn btn-secondary" href="/import">Import CSV</a>
		{/snippet}
	</EmptyState>
{:else}
	<div class="ws-grid ws-grid--flush ws-grid--side">
		<div class="ws-pad">
			<h4>PDF statement</h4>
			<p class="text-muted small">
				Assembled on the server with pdf-lib, from the same figures on screen. Pick the sections you
				want.
			</p>

			<div class="toggles" role="group" aria-label="Report sections">
				<label><input type="checkbox" bind:checked={netWorth} /> Net worth statement</label>
				<label><input type="checkbox" bind:checked={allocation} /> Allocation &amp; liquidity</label
				>
				<label><input type="checkbox" bind:checked={risk} /> Risk &amp; concentration</label>
				<label><input type="checkbox" bind:checked={records} /> Full record listing</label>
			</div>

			<a class="btn btn-primary btn-block" href={pdfHref} download>Generate PDF report</a>
			<button type="button" class="btn btn-secondary btn-block" onclick={() => window.print()}>
				Print this page
			</button>

			<p class="text-muted tiny">
				The report states figures computed from your records on the generation date. It carries a
				basis-of-preparation note and is not financial advice.
			</p>

			<div class="hr"></div>

			<h4>CSV export</h4>
			<p class="text-muted small">
				Column names mirror the import templates, so a round trip is lossless. Values are exported
				at full stored precision, not rounded for display.
			</p>
			<div class="exports">
				{#each data.exportKinds as kind (kind.kind)}
					<div class="export-row">
						<div>
							<span class="export-label">{kind.label}</span>
							<span class="text-muted tiny">{kind.description}</span>
						</div>
						<a class="btn btn-secondary" href="/api/exports/csv?kind={kind.kind}" download>
							Download
						</a>
					</div>
				{/each}
			</div>
		</div>

		<div class="ws-pad ws-scroll-x preview">
			<h4>Statement preview</h4>
			<p class="text-muted tiny">
				{data.userName} · base currency {m.baseCurrency} · as at {fmt.date(data.asOf)}
			</p>

			<div class="hr"></div>

			<h5>Net worth</h5>
			<div class="ws-kv">
				<span>Total assets</span><span>{fmt.money(m.netWorth.totalAssets)}</span>
			</div>
			<div class="ws-kv">
				<span>Total liabilities</span><span>{fmt.money(m.netWorth.totalLiabilities)}</span>
			</div>
			<div class="ws-kv total">
				<span>Net worth</span><span>{fmt.money(m.netWorth.netWorth)}</span>
			</div>
			<div class="ws-kv">
				<span>Liquid assets</span><span>{fmt.money(m.netWorth.liquidAssets)}</span>
			</div>
			<div class="ws-kv">
				<span>Investment assets</span><span>{fmt.money(m.netWorth.investmentAssets)}</span>
			</div>

			<div class="hr"></div>

			<h5>Cash flow</h5>
			<div class="ws-kv">
				<span>Monthly income</span><span>{fmt.money(m.cashflow.monthlyIncome)}</span>
			</div>
			<div class="ws-kv">
				<span>Monthly expenses</span><span>{fmt.money(m.cashflow.monthlyExpenses)}</span>
			</div>
			<div class="ws-kv">
				<span>Savings rate</span><span><PercentageDisplay value={m.cashflow.savingsRate} /></span>
			</div>

			<div class="hr"></div>

			<h5>Allocation</h5>
			<table class="table">
				<caption class="visually-hidden">Assets by class</caption>
				<thead>
					<tr>
						<th scope="col">Class</th>
						<th scope="col" class="num">Value</th>
						<th scope="col" class="num">Share</th>
					</tr>
				</thead>
				<tbody>
					{#each m.allocationByClass as slice (slice.key)}
						<tr>
							<td>{slice.label}</td>
							<td class="num">{fmt.money(slice.value)}</td>
							<td class="num"><PercentageDisplay value={slice.share} /></td>
						</tr>
					{/each}
				</tbody>
			</table>

			{#if data.snapshots.length > 0}
				<div class="hr"></div>
				<h5>Recorded snapshots</h5>
				<table class="table">
					<caption class="visually-hidden">Net worth snapshot history</caption>
					<thead>
						<tr>
							<th scope="col">Date</th>
							<th scope="col" class="num">Assets</th>
							<th scope="col" class="num">Liabilities</th>
							<th scope="col" class="num">Net worth</th>
						</tr>
					</thead>
					<tbody>
						{#each data.snapshots as snapshot (snapshot.snapshotDate)}
							<tr>
								<td>{fmt.date(snapshot.snapshotDate)}</td>
								<td class="num">{fmt.money(snapshot.totalAssets)}</td>
								<td class="num">{fmt.money(snapshot.totalLiabilities)}</td>
								<td class="num strong">{fmt.money(snapshot.netWorth)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			{#if m.missingRates.length > 0}
				<p class="text-muted tiny warn">
					Incomplete: no exchange rate for {m.missingRates.join(', ')}. Holdings in those currencies
					are excluded from every total above.
				</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	h4 {
		margin: 0 0 var(--space-2);
	}
	h5 {
		margin: 0 0 var(--space-3);
	}
	.small {
		font-size: 12.5px;
	}
	.tiny {
		font-size: 11.5px;
	}
	.warn {
		color: var(--color-accent-700);
		border-top: 2px solid var(--color-divider);
		padding-top: var(--space-3);
		margin-top: var(--space-4);
	}
	.toggles {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		margin: var(--space-3) 0;
	}
	.toggles label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}
	.toggles input {
		accent-color: var(--color-accent);
		width: 16px;
		height: 16px;
	}
	.exports {
		display: flex;
		flex-direction: column;
	}
	.export-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		border-top: 1px solid var(--color-divider);
		padding: var(--space-3) 0;
	}
	.export-label {
		display: block;
		font-weight: 600;
		font-size: 13px;
	}
	.total {
		font-family: var(--font-heading);
		font-weight: 800;
	}
	.strong {
		font-weight: 600;
	}
	.preview {
		background: var(--color-bg);
	}
</style>
