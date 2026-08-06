<script lang="ts">
	import MetricCard from '$components/base/MetricCard.svelte';
	import PercentageDisplay from '$components/base/PercentageDisplay.svelte';
	import AllocationBar from '$components/charts/AllocationBar.svelte';
	import ChartFrame from '$components/charts/ChartFrame.svelte';
	import FlowBars from '$components/charts/FlowBars.svelte';
	import HealthMeter from '$components/charts/HealthMeter.svelte';
	import TrendChart from '$components/charts/TrendChart.svelte';
	import EmptyState from '$components/feedback/EmptyState.svelte';
	import ErrorMessage from '$components/feedback/ErrorMessage.svelte';
	import { getFormatters } from '$lib/stores/formatting.svelte';
	import { TRANSACTION_TYPE_LABELS } from '$lib/types/domain';
	import { barWidth, dec } from '$engine/money';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const fmt = getFormatters();
	const m = $derived(data.metrics);

	const maxFlow = $derived(
		Math.max(
			1,
			...data.flow.map((p) => Math.max(dec(p.income).toNumber(), dec(p.expenses).toNumber()))
		) * 1.2
	);

	const flowBars = $derived(
		data.flow.map((point) => ({
			month: point.month,
			label: point.label,
			incomePercent: (dec(point.income).toNumber() / maxFlow) * 55,
			expensePercent: (dec(point.expenses).toNumber() / maxFlow) * 55,
			title: `${point.month}: income ${fmt.money(point.income)}, expenses ${fmt.money(point.expenses)}`
		}))
	);

	const largestPositions = $derived(m.balanceSheetConcentration.positions.slice(0, 5));
	const classCount = $derived(m.allocationByClass.length);
</script>

{#if m.isEmpty}
	<EmptyState
		title="No records yet"
		description="This account is empty. Add your first asset, import a CSV export from your bank or broker, or record an income stream to see every analysis screen populated."
	>
		{#snippet actions()}
			<a class="btn btn-primary" href="/assets/new">Add an asset</a>
			<a class="btn btn-secondary" href="/import">Import CSV</a>
			<a class="btn btn-secondary" href="/cashflow/new">Add income or expense</a>
		{/snippet}
	</EmptyState>
{:else}
	{#if m.missingRates.length > 0}
		<div class="notice">
			<ErrorMessage
				tone="warning"
				message="No exchange rate is recorded for {m.missingRates.join(
					', '
				)}. Holdings in those currencies are excluded from every total below. Add a rate in Settings to include them."
			/>
		</div>
	{/if}

	<!-- Summary strip -->
	<div class="ws-grid ws-grid--4">
		<MetricCard
			label="Net worth"
			value={fmt.money(m.netWorth.netWorth)}
			note={data.netWorthDelta
				? `${fmt.money(data.netWorthDelta, { signed: true })} across ${data.snapshotCount} snapshots`
				: 'No history yet — run an analysis to record a snapshot'}
			noteTone={data.netWorthDelta ? 'accent' : 'muted'}
		/>
		<MetricCard
			label="Total assets"
			value={fmt.money(m.netWorth.totalAssets)}
			note="{m.holdingCount} records across {classCount} {classCount === 1 ? 'class' : 'classes'}"
		/>
		<MetricCard
			label="Liabilities"
			value={fmt.money(m.netWorth.totalLiabilities)}
			note="Debt-to-assets {m.debt.debtToAssets ? fmt.percent(m.debt.debtToAssets) : '—'}"
		/>
		<MetricCard
			label="Monthly net flow"
			value={fmt.money(m.cashflow.netCashflow, { signed: true })}
			note="Savings rate {m.cashflow.savingsRate ? fmt.percent(m.cashflow.savingsRate) : '—'}"
		/>
	</div>

	<!-- Net worth trend + financial health -->
	<div class="ws-grid ws-grid--side">
		<div class="ws-pad ws-scroll-x">
			<ChartFrame
				title="Net worth"
				meta="Assets less liabilities, at each recorded snapshot"
				summary={data.trend.length > 1
					? `Net worth across ${data.trend.length} snapshots, ending at ${fmt.money(m.netWorth.netWorth)}.`
					: 'Not enough snapshots to draw a trend yet.'}
				status={data.trend.length > 1 ? 'ready' : 'empty'}
				emptyMessage="Run an analysis to record your first snapshot. Two or more snapshots draw a trend."
			>
				<TrendChart
					series={[{ values: data.trend, stroke: 'var(--color-accent)', width: 2.5 }]}
					labels={data.trendLabels}
				/>

				{#snippet alternative()}
					<table class="table">
						<caption class="visually-hidden">Net worth at each recorded snapshot</caption>
						<thead>
							<tr><th scope="col">Snapshot</th><th scope="col" class="num">Net worth</th></tr>
						</thead>
						<tbody>
							{#each data.trend as value, i (i)}
								<tr>
									<td>{data.trendLabels[Math.min(i, data.trendLabels.length - 1)] ?? i + 1}</td>
									<td class="num">{fmt.money(String(value))}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/snippet}
			</ChartFrame>
		</div>

		<div class="ws-pad">
			<h4>Financial health</h4>
			<HealthMeter score={m.health.composite} band={m.health.band} />
			<div class="ws-stack--tight rows">
				<div class="ws-kv">
					<span>Liquidity cover</span>
					<span>{m.liquidityCover ? `${m.liquidityCover.toFixed(1)} mo` : '—'}</span>
				</div>
				<div class="ws-kv">
					<span>Debt-to-assets</span>
					<span><PercentageDisplay value={m.debt.debtToAssets} /></span>
				</div>
				<div class="ws-kv">
					<span>Savings rate</span>
					<span><PercentageDisplay value={m.cashflow.savingsRate} /></span>
				</div>
				<div class="ws-kv">
					<span>Concentration (HHI)</span>
					<span>{m.portfolioConcentration.hhi ? m.portfolioConcentration.hhi.toFixed(2) : '—'}</span
					>
				</div>
			</div>
			<a class="btn btn-ghost open" href="/analyze/overview">Open full analysis →</a>
		</div>
	</div>

	<!-- Allocation + liquidity -->
	<div class="ws-grid ws-grid--2">
		<div class="ws-pad ws-scroll-x">
			<h4>Asset allocation</h4>
			<AllocationBar
				segments={m.allocationByClass.map((slice) => ({
					key: slice.key,
					label: slice.label,
					color: data.allocationColors[slice.key] ?? 'var(--color-neutral-300)',
					percent: barWidth(slice.share),
					valueLabel: fmt.money(slice.value)
				}))}
			/>
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
							<td>
								<span class="swatch-row">
									<span
										class="ws-swatch"
										style="background:{data.allocationColors[slice.key]}"
										aria-hidden="true"
									></span>
									{slice.label}
								</span>
							</td>
							<td class="num">{fmt.money(slice.value)}</td>
							<td class="num"><PercentageDisplay value={slice.share} /></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="ws-pad">
			<h4>Liquidity ladder</h4>
			<div class="ws-stack">
				{#each m.liquidity as band (band.key)}
					<div>
						<div class="band-head">
							<span class="band-label">{band.label}</span>
							<span class="num"
								>{fmt.money(band.value)} · {band.share ? fmt.percent(band.share) : '—'}</span
							>
						</div>
						<div class="ws-track">
							<span class="ws-fill" style="background:{band.color};width:{barWidth(band.share)}%"
							></span>
						</div>
						<p class="band-note text-muted">{band.note}</p>
					</div>
				{/each}
			</div>
			<div class="cover">
				<span>Emergency cover</span>
				<span class="cover-value"
					>{m.liquidityCover ? `${m.liquidityCover.toFixed(1)} months` : '—'}</span
				>
			</div>
			{#if m.currencyExposure.length > 1}
				<div class="exposure">
					<h5>Currency exposure</h5>
					{#each m.currencyExposure as exposure (exposure.currency)}
						<div class="ws-kv">
							<span>{exposure.currency}</span>
							<span>{fmt.money(exposure.value)} · <PercentageDisplay value={exposure.share} /></span
							>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Cash flow + positions + activity -->
	<div class="ws-grid ws-grid--flush ws-grid--side">
		<div class="ws-pad ws-scroll-x">
			<ChartFrame
				title="Twelve-month cash flow"
				meta="Income above the axis, expenses below"
				summary="Monthly income and expenses over the last twelve months. Income averages {fmt.money(
					m.cashflow.monthlyIncome
				)} and expenses {fmt.money(m.cashflow.monthlyExpenses)}."
				status={m.cashflow.monthlyIncome.isZero() && m.cashflow.monthlyExpenses.isZero()
					? 'empty'
					: 'ready'}
				height="150px"
				emptyMessage="Record an income stream or an expense category to see cash flow here."
			>
				<FlowBars bars={flowBars} />

				{#snippet alternative()}
					<table class="table">
						<caption class="visually-hidden">Monthly income and expenses</caption>
						<thead>
							<tr>
								<th scope="col">Month</th>
								<th scope="col" class="num">Income</th>
								<th scope="col" class="num">Expenses</th>
							</tr>
						</thead>
						<tbody>
							{#each data.flow as point (point.month)}
								<tr>
									<td>{point.month}</td>
									<td class="num">{fmt.money(point.income)}</td>
									<td class="num">{fmt.money(point.expenses)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/snippet}
			</ChartFrame>

			{#if largestPositions.length > 0}
				<div class="ws-rule-top">
					<h5>Largest positions</h5>
					<table class="table">
						<caption class="visually-hidden">Largest positions by value</caption>
						<thead>
							<tr>
								<th scope="col">Holding</th>
								<th scope="col" class="num">Value</th>
								<th scope="col" class="num">Share of assets</th>
							</tr>
						</thead>
						<tbody>
							{#each largestPositions as position (position.key)}
								<tr>
									<td>{position.label}</td>
									<td class="num">{fmt.money(position.value)}</td>
									<td class="num">{fmt.percent(position.share)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<div class="ws-pad">
			<h5>Recent transactions</h5>
			{#if data.recentTransactions.length === 0}
				<p class="text-muted small">
					No transactions recorded. Buys, sells, dividends and fees give the return figures their
					cost basis.
				</p>
				<a class="btn btn-secondary btn-block" href="/investments">Record a transaction</a>
			{:else}
				<div class="ws-stack--tight">
					{#each data.recentTransactions as tx (tx.id)}
						<div class="tx">
							<div class="tx-main">
								<span class="tx-name"
									>{tx.assetSymbol ?? tx.assetName ?? tx.accountName ?? 'Transaction'}</span
								>
								<span class="text-muted tx-meta"
									>{TRANSACTION_TYPE_LABELS[tx.type as keyof typeof TRANSACTION_TYPE_LABELS] ??
										tx.type} · {fmt.date(tx.date)}</span
								>
							</div>
							<span class="num">{fmt.money(tx.amount, { currency: tx.currency })}</span>
						</div>
					{/each}
				</div>
				<a class="btn btn-ghost open" href="/investments">All transactions →</a>
			{/if}
		</div>
	</div>
{/if}

<style>
	.notice {
		padding: var(--space-4) var(--space-6) 0;
	}
	h4 {
		margin: 0 0 var(--space-4);
	}
	h5 {
		margin: 0 0 var(--space-3);
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.open {
		margin-top: var(--space-3);
		padding-left: 0;
	}
	.swatch-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.band-head {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
		margin-bottom: 4px;
		gap: var(--space-2);
	}
	.band-label {
		font-weight: 600;
	}
	.band-note {
		font-size: 11px;
		margin: 3px 0 0;
	}
	.cover {
		border-top: 2px solid var(--color-divider);
		margin-top: var(--space-4);
		padding-top: var(--space-3);
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-size: 13px;
		gap: var(--space-2);
	}
	.cover-value {
		font-family: var(--font-heading);
		font-weight: 800;
		font-size: 22px;
		font-variant-numeric: tabular-nums;
	}
	.exposure {
		margin-top: var(--space-4);
		border-top: 2px solid var(--color-divider);
		padding-top: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.tx {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		align-items: baseline;
		border-bottom: 1px solid var(--color-divider);
		padding-bottom: 6px;
		font-size: 13px;
	}
	.tx-main {
		min-width: 0;
	}
	.tx-name {
		display: block;
		font-weight: 600;
	}
	.tx-meta {
		display: block;
		font-size: 11px;
	}
	.small {
		font-size: 12.5px;
	}
</style>
