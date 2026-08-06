<script lang="ts">
	/** The stacked allocation band above the allocation table. */
	interface Segment {
		key: string;
		label: string;
		color: string;
		/** Percentage width, 0–100. */
		percent: number;
		valueLabel: string;
	}

	interface Props {
		segments: readonly Segment[];
		height?: number;
	}

	let { segments, height = 32 }: Props = $props();
</script>

<div class="bar" style="height:{height}px" aria-hidden="true">
	{#each segments as segment (segment.key)}
		<span
			style="background:{segment.color};width:{segment.percent}%"
			title="{segment.label} · {segment.valueLabel}"
		></span>
	{/each}
</div>

<style>
	.bar {
		display: flex;
		width: 100%;
		margin-bottom: var(--space-4);
		background: var(--color-neutral-200);
	}
	.bar span {
		display: block;
		min-width: 0;
	}
</style>
