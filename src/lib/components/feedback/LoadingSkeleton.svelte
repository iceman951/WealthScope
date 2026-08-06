<script lang="ts">
	/**
	 * Placeholder blocks sized like the content they stand in for, so the layout
	 * does not shift when real data arrives.
	 */
	interface Props {
		variant?: 'metric' | 'table' | 'chart' | 'text';
		rows?: number;
		label?: string;
	}

	let { variant = 'text', rows = 4, label = 'Loading' }: Props = $props();
</script>

<div class="skeleton" role="status" aria-live="polite" aria-busy="true">
	<span class="visually-hidden">{label}</span>
	{#if variant === 'metric'}
		<div class="ws-skeleton line kicker"></div>
		<div class="ws-skeleton line metric"></div>
		<div class="ws-skeleton line note"></div>
	{:else if variant === 'chart'}
		<div class="ws-skeleton chart"></div>
	{:else if variant === 'table'}
		<div class="ws-skeleton line head"></div>
		{#each Array.from({ length: rows }) as _, i (i)}
			<div class="ws-skeleton line row"></div>
		{/each}
	{:else}
		{#each Array.from({ length: rows }) as _, i (i)}
			<div class="ws-skeleton line text"></div>
		{/each}
	{/if}
</div>

<style>
	.skeleton {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.line {
		display: block;
	}
	.kicker {
		height: 10px;
		width: 30%;
	}
	.metric {
		height: calc(var(--ws-metric) * 0.8);
		width: 60%;
	}
	.note {
		height: 12px;
		width: 45%;
	}
	.head {
		height: 14px;
		width: 100%;
	}
	.row {
		height: 34px;
		width: 100%;
	}
	.text {
		height: 12px;
		width: 100%;
	}
	.chart {
		height: 220px;
		width: 100%;
		display: block;
	}
</style>
