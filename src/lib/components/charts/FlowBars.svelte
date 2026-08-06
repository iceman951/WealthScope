<script lang="ts">
	/** Twelve-month cash flow: income above the axis, expenses below. */
	interface Bar {
		month: string;
		label: string;
		incomePercent: number;
		expensePercent: number;
		title: string;
	}

	interface Props {
		bars: readonly Bar[];
	}

	let { bars }: Props = $props();
</script>

<div class="chart" aria-hidden="true">
	{#each bars as bar (bar.month)}
		<div class="col" title={bar.title}>
			<span class="in" style="height:{Math.max(0, Math.min(55, bar.incomePercent))}%"></span>
			<span class="out" style="height:{Math.max(0, Math.min(55, bar.expensePercent))}%"></span>
		</div>
	{/each}
</div>
<div class="labels" aria-hidden="true">
	{#each bars as bar (bar.month)}<span>{bar.label}</span>{/each}
</div>

<style>
	.chart {
		display: grid;
		grid-template-columns: repeat(12, 1fr);
		gap: 8px;
		align-items: end;
		height: 150px;
	}
	.col {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		height: 100%;
		gap: 2px;
	}
	.in {
		display: block;
		background: var(--color-text);
	}
	.out {
		display: block;
		background: var(--color-accent-300);
	}
	.labels {
		display: grid;
		grid-template-columns: repeat(12, 1fr);
		gap: 8px;
		margin-top: 6px;
	}
	.labels span {
		font-size: 10px;
		text-align: center;
		color: color-mix(in srgb, var(--color-text) 50%, transparent);
	}
	@media (max-width: 900px) {
		.chart,
		.labels {
			gap: 3px;
		}
	}
</style>
