<script lang="ts">
	import { healthTicks } from '$engine/health-score';

	/** The 20-segment composite score meter from the dashboard. */
	interface Props {
		score: number | null;
		band: string | null;
	}

	let { score, band }: Props = $props();

	const ticks = $derived(healthTicks(score));
</script>

<div class="meter">
	<div class="headline">
		<span class="score">{score ?? '—'}</span>
		<span class="text-muted">/ 100 · {band ?? 'Not enough data'}</span>
	</div>
	<div
		class="ticks"
		role="meter"
		aria-valuenow={score ?? undefined}
		aria-valuemin="0"
		aria-valuemax="100"
		aria-label="Financial health score"
		aria-valuetext={score === null ? 'Not enough data yet' : `${score} out of 100, ${band}`}
	>
		{#each ticks as tick (tick.index)}
			<span style="background:{tick.color}"></span>
		{/each}
	</div>
</div>

<style>
	.headline {
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
	}
	.score {
		font-family: var(--font-heading);
		font-weight: 800;
		font-size: calc(var(--ws-metric) * 1.25);
		line-height: 1;
		letter-spacing: -0.03em;
		font-variant-numeric: tabular-nums;
	}
	.headline .text-muted {
		font-size: 13px;
	}
	.ticks {
		display: flex;
		gap: 3px;
		margin: var(--space-4) 0;
	}
	.ticks span {
		flex: 1;
		height: 26px;
		display: block;
	}
</style>
