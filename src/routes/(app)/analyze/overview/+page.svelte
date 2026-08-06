<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$components/base/Button.svelte';
	import PercentageDisplay from '$components/base/PercentageDisplay.svelte';
	import BarMeter from '$components/charts/BarMeter.svelte';
	import EmptyState from '$components/feedback/EmptyState.svelte';
	import ErrorMessage from '$components/feedback/ErrorMessage.svelte';
	import { getFormatters } from '$lib/stores/formatting.svelte';
	import { showToast } from '$lib/stores/toast.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const fmt = getFormatters();
	const m = $derived(data.metrics);

	let running = $state(false);

	$effect(() => {
		if (form?.success === true) showToast(form.message);
	});
</script>

{#if m.isEmpty}
	<EmptyState
		title="Nothing to analyse yet"
		description="The analysis runs over every record in this account: net worth composition, allocation drift, liquidity cover, debt load, portfolio risk and projected wealth. Add a record or import a CSV to give it something to read."
	>
		{#snippet actions()}
			<a class="btn btn-primary" href="/assets">Add an asset</a>
			<a class="btn btn-secondary" href="/import">Import CSV</a>
		{/snippet}
	</EmptyState>
{:else}
	<div class="ws-grid ws-grid--side">
		<div class="ws-pad ws-scroll-x">
			<h4>Score by dimension</h4>
			<div class="ws-stack">
				{#each m.health.dimensions as dimension (dimension.id)}
					<BarMeter
						label={dimension.label}
						percent={dimension.score ?? 0}
						valueLabel={dimension.score === null
							? 'Not enough data'
							: `${dimension.score} · ${dimension.band}`}
						color={dimension.score !== null && dimension.score >= 60
							? 'var(--color-text)'
							: 'var(--color-accent)'}
						size="lg"
						note={dimension.detail}
					/>
				{/each}
			</div>

			{#if m.health.skipped.length > 0}
				<p class="text-muted small">
					{m.health.skipped.join(', ')}
					{m.health.skipped.length === 1 ? 'was' : 'were'} left out of the composite for want of data
					— an empty portfolio is not an unhealthy one.
				</p>
			{/if}
		</div>

		<div class="ws-pad">
			<div class="ws-kicker">Composite score</div>
			<div class="ws-value ws-value--xl">{m.health.composite ?? '—'}</div>
			<p class="band">
				{m.health.band ?? 'Not enough data'}
				{#if data.lastRun}· last run {fmt.date(data.lastRun)}{/if}
			</p>

			<div class="hr"></div>

			{#if form?.success === false && form.errors._form}
				<ErrorMessage message={form.errors._form.join(' ')} code={form.code} />
			{/if}

			<form
				method="POST"
				action="?/run"
				use:enhance={() => {
					running = true;
					return async ({ update }) => {
						await update();
						running = false;
					};
				}}
			>
				<Button variant="primary" type="submit" block pending={running} pendingLabel="Computing…">
					Run analysis &amp; record snapshot
				</Button>
			</form>
			<a class="btn btn-secondary btn-block" href="/reports">Export PDF report</a>

			{#if running}
				<p class="ws-pulse-text running">
					Computing — reading {m.recordCount} records
				</p>
			{/if}

			<div class="hr"></div>
			<div class="ws-kv"><span>Records in scope</span><span>{m.recordCount}</span></div>
			<div class="ws-kv"><span>Dimensions</span><span>{m.health.dimensions.length}</span></div>
			<div class="ws-kv"><span>Base currency</span><span>{m.baseCurrency}</span></div>
		</div>
	</div>

	<div class="ws-grid ws-grid--4">
		<div class="ws-pad--tight">
			<div class="ws-kicker">Net worth</div>
			<div class="ws-value ws-value--sm">{fmt.money(m.netWorth.netWorth)}</div>
		</div>
		<div class="ws-pad--tight">
			<div class="ws-kicker">Liquidity cover</div>
			<div class="ws-value ws-value--sm">
				{m.liquidityCover ? `${m.liquidityCover.toFixed(1)} mo` : '—'}
			</div>
		</div>
		<div class="ws-pad--tight">
			<div class="ws-kicker">Debt-to-assets</div>
			<div class="ws-value ws-value--sm">
				<PercentageDisplay value={m.debt.debtToAssets} />
			</div>
		</div>
		<div class="ws-pad--tight">
			<div class="ws-kicker">Savings rate</div>
			<div class="ws-value ws-value--sm">
				<PercentageDisplay value={m.cashflow.savingsRate} />
			</div>
		</div>
	</div>

	<div class="ws-pad ws-scroll-x">
		<h4>Findings</h4>
		{#if data.findings.length === 0}
			<p class="text-muted small">
				No findings fired. That means no rule's threshold was crossed — not that there is nothing to
				improve.
			</p>
		{:else}
			<div class="findings">
				{#each data.findings as finding (finding.id)}
					<div class="finding">
						<span class="tag {finding.tagClass}">{finding.severity}</span>
						<div>
							<div class="finding-title">{finding.title}</div>
							<div class="text-muted finding-body">{finding.body}</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
		<p class="text-muted small footnote">
			Findings are rule objects with a severity, a predicate over the computed metrics and a copy
			template. Every threshold quoted above is stated in the rule itself — nothing here is a
			proprietary score, and none of it is financial advice.
		</p>
	</div>
{/if}

<style>
	h4 {
		margin: 0 0 var(--space-4);
	}
	.band {
		font-size: 13px;
		margin: 0;
	}
	.running {
		margin-top: var(--space-3);
		font-size: 12px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.small {
		font-size: 11.5px;
		margin-top: var(--space-4);
	}
	.findings {
		display: flex;
		flex-direction: column;
	}
	.finding {
		display: grid;
		grid-template-columns: minmax(0, 88px) minmax(0, 1fr);
		gap: var(--space-4);
		padding: var(--space-3) 0;
		border-top: 1px solid var(--color-divider);
		align-items: start;
	}
	.finding-title {
		font-weight: 600;
		font-size: 14px;
	}
	.finding-body {
		font-size: 12.5px;
	}
	.footnote {
		border-top: 2px solid var(--color-divider);
		padding-top: var(--space-3);
	}
	@media (max-width: 560px) {
		.finding {
			grid-template-columns: 1fr;
			gap: var(--space-2);
		}
	}
</style>
