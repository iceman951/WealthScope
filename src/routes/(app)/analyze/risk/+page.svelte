<script lang="ts">
	import PercentageDisplay from '$components/base/PercentageDisplay.svelte';
	import BarMeter from '$components/charts/BarMeter.svelte';
	import CorrelationHeatmap from '$components/charts/CorrelationHeatmap.svelte';
	import EmptyState from '$components/feedback/EmptyState.svelte';
	import ErrorMessage from '$components/feedback/ErrorMessage.svelte';
	import { getFormatters } from '$lib/stores/formatting.svelte';
	import { MIN_OBSERVATIONS } from '$engine/risk';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const fmt = getFormatters();
	const m = $derived(data.metrics);

	let tab = $state<'volatility' | 'concentration' | 'correlation'>('volatility');

	const maxVol = $derived(
		Math.max(1, ...data.volatilities.map((v) => (v.annualised ? v.annualised.toNumber() : 0)))
	);
</script>

<div class="ws-grid ws-grid--4">
	<div class="ws-pad--tight">
		<div class="ws-kicker">Holdings with history</div>
		<div class="ws-value ws-value--sm">
			{data.volatilities.filter((v) => v.sufficient).length} / {data.holdingCount}
		</div>
	</div>
	<div class="ws-pad--tight">
		<div class="ws-kicker">Concentration (HHI)</div>
		<div class="ws-value ws-value--sm">
			{m.portfolioConcentration.hhi ? m.portfolioConcentration.hhi.toFixed(2) : '—'}
		</div>
	</div>
	<div class="ws-pad--tight">
		<div class="ws-kicker">Single-name exposure</div>
		<div class="ws-value ws-value--sm">
			<PercentageDisplay value={m.portfolioConcentration.top1Share} />
		</div>
	</div>
	<div class="ws-pad--tight">
		<div class="ws-kicker">Effective holdings</div>
		<div class="ws-value ws-value--sm">
			{m.portfolioConcentration.effectiveHoldings
				? m.portfolioConcentration.effectiveHoldings.toFixed(1)
				: '—'}
		</div>
	</div>
</div>

{#if data.holdingCount === 0}
	<EmptyState
		title="No portfolio to measure"
		description="Risk metrics need investment holdings. Add equities, funds, bonds or crypto on the Assets screen, then record prices over time to unlock volatility, drawdown and correlation."
	>
		{#snippet actions()}
			<a class="btn btn-primary" href="/assets">Add a holding</a>
		{/snippet}
	</EmptyState>
{:else}
	<div class="ws-tabs sub-tabs" role="tablist" aria-label="Risk views">
		<button
			type="button"
			class="ws-tab"
			role="tab"
			aria-selected={tab === 'volatility'}
			aria-current={tab === 'volatility' ? 'page' : undefined}
			onclick={() => (tab = 'volatility')}>Volatility &amp; stress</button
		>
		<button
			type="button"
			class="ws-tab"
			role="tab"
			aria-selected={tab === 'concentration'}
			aria-current={tab === 'concentration' ? 'page' : undefined}
			onclick={() => (tab = 'concentration')}>Concentration</button
		>
		<button
			type="button"
			class="ws-tab"
			role="tab"
			aria-selected={tab === 'correlation'}
			aria-current={tab === 'correlation' ? 'page' : undefined}
			onclick={() => (tab = 'correlation')}>Correlation</button
		>
	</div>

	{#if tab === 'volatility'}
		<div class="ws-grid ws-grid--flush ws-grid--side">
			<div class="ws-pad ws-scroll-x">
				<h5>Annualised volatility by holding</h5>
				{#if data.volatilities.every((v) => !v.sufficient)}
					<ErrorMessage
						tone="warning"
						message="No holding has {MIN_OBSERVATIONS} recorded prices yet, which is the minimum before a volatility figure means anything. Record prices over time — or import a price history — and this fills in."
					/>
				{:else}
					<div class="ws-stack">
						{#each data.volatilities as row (row.assetId)}
							<BarMeter
								label={row.label}
								percent={row.annualised ? (row.annualised.toNumber() / maxVol) * 100 : 0}
								valueLabel={row.annualised ? fmt.percent(row.annualised) : 'Not enough data'}
								color={row.annualised && row.annualised.greaterThan(18)
									? 'var(--color-accent)'
									: 'var(--color-text)'}
								size="md"
								note={row.sufficient
									? `${row.observations} observations · max drawdown ${
											row.maxDrawdown ? fmt.percent(row.maxDrawdown) : '—'
										}`
									: `${row.observations} of ${MIN_OBSERVATIONS} observations needed`}
							/>
						{/each}
					</div>
				{/if}
				<p class="text-muted small">
					Volatility is the annualised standard deviation of the price history you have recorded.
					Below {MIN_OBSERVATIONS} observations no figure is published: the engine does not substitute
					a class-level assumption and present it as a measurement.
				</p>
			</div>

			<div class="ws-pad">
				<h5>Stress tests</h5>
				<table class="table">
					<caption class="visually-hidden">Stress scenarios and their impact</caption>
					<thead>
						<tr><th scope="col">Scenario</th><th scope="col" class="num">Impact</th></tr>
					</thead>
					<tbody>
						{#each m.stress as result (result.scenario.id)}
							<tr>
								<td>
									<span class="name">{result.scenario.label}</span>
									<span class="text-muted meta">{result.scenario.note}</span>
								</td>
								<td class="num strong">{fmt.money(result.impact)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<p class="text-muted small">
					Scenarios are static shock vectors shipped with the application, applied to your current
					weights. No historical market data is stored or redistributed, and these are illustrations
					rather than predictions.
				</p>
			</div>
		</div>
	{:else if tab === 'concentration'}
		<div class="ws-grid ws-grid--flush ws-grid--side">
			<div class="ws-pad ws-scroll-x">
				<h5>Concentration — cumulative weight</h5>
				<table class="table">
					<caption class="visually-hidden">Holdings by weight with cumulative share</caption>
					<thead>
						<tr>
							<th scope="col">Holding</th>
							<th scope="col" class="num">Weight</th>
							<th scope="col" class="num">Cumulative</th>
						</tr>
					</thead>
					<tbody>
						{#each m.portfolioConcentration.positions as position (position.key)}
							<tr>
								<td>{position.label}</td>
								<td class="num">{fmt.percent(position.share)}</td>
								<td class="num">{fmt.percent(position.cumulative)}</td>
							</tr>
						{/each}
					</tbody>
				</table>

				<div class="ws-grid ws-grid--3 ws-grid--flush stats">
					<div>
						<div class="ws-kicker">Top 1</div>
						<div class="ws-value ws-value--fixed">
							<PercentageDisplay value={m.portfolioConcentration.top1Share} />
						</div>
					</div>
					<div>
						<div class="ws-kicker">Top 3</div>
						<div class="ws-value ws-value--fixed">
							<PercentageDisplay value={m.portfolioConcentration.top3Share} />
						</div>
					</div>
					<div>
						<div class="ws-kicker">Effective holdings</div>
						<div class="ws-value ws-value--fixed">
							{m.portfolioConcentration.effectiveHoldings
								? m.portfolioConcentration.effectiveHoldings.toFixed(1)
								: '—'}
						</div>
					</div>
				</div>
			</div>

			<div class="ws-pad">
				<h5>Whole-balance-sheet view</h5>
				<p class="text-muted small">
					Concentration is also measured across the full balance sheet, not just the portfolio.
					{#if m.balanceSheetConcentration.positions[0]}
						The largest single asset — {m.balanceSheetConcentration.positions[0].label} — is
						{fmt.percent(m.balanceSheetConcentration.positions[0].share)} of total assets.
					{/if}
				</p>
				<div class="ws-boxed">
					<div class="ws-kicker">Herfindahl index</div>
					<div class="ws-value ws-value--fixed-lg">
						{m.balanceSheetConcentration.hhi ? m.balanceSheetConcentration.hhi.toFixed(2) : '—'}
					</div>
					<p class="text-muted tiny">
						Below 0.15 diversified · 0.15–0.25 moderate · above 0.25 concentrated.
					</p>
				</div>
				<div class="hr"></div>
				<h5>Currency exposure</h5>
				{#each m.currencyExposure as exposure (exposure.currency)}
					<div class="ws-kv">
						<span>{exposure.currency}</span>
						<span>{fmt.money(exposure.value)} · <PercentageDisplay value={exposure.share} /></span>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="ws-pad ws-scroll-x">
			<CorrelationHeatmap
				labels={data.correlation.labels}
				cells={data.correlation.cells}
				complete={data.correlation.complete}
			/>
		</div>
	{/if}
{/if}

<style>
	.sub-tabs {
		background: var(--color-bg);
	}
	h5 {
		margin: 0 0 var(--space-4);
	}
	.name {
		display: block;
		font-weight: 600;
	}
	.meta {
		display: block;
		font-size: 11px;
	}
	.strong {
		font-weight: 600;
	}
	.small {
		font-size: 11.5px;
		margin-top: var(--space-4);
		max-width: 70ch;
	}
	.tiny {
		font-size: 11.5px;
		margin: 6px 0 0;
	}
	.stats {
		margin-top: var(--space-6);
		border-top: 2px solid var(--color-divider);
		padding-top: var(--space-4);
		background: transparent;
		gap: var(--space-4);
	}
	.stats > :global(*) {
		background: transparent;
	}
</style>
