<script lang="ts">
	/**
	 * Label / track / value — the row shape used by score bars, volatility bars,
	 * sleeve weights and the liquidity ladder.
	 */
	interface Props {
		label: string;
		/** 0–100. */
		percent: number;
		valueLabel: string;
		color?: string;
		/** A second mark on the track, e.g. a target weight. */
		markerPercent?: number | null;
		markerLabel?: string;
		size?: 'sm' | 'md' | 'lg';
		note?: string;
	}

	let {
		label,
		percent,
		valueLabel,
		color = 'var(--color-text)',
		markerPercent = null,
		markerLabel = 'Target',
		size = 'md',
		note
	}: Props = $props();

	const clamped = $derived(Math.max(0, Math.min(100, percent)));
</script>

<div class="ws-bar-row">
	<span>{label}</span>
	<div class="ws-track ws-track--{size}">
		<span class="ws-fill" style="background:{color};width:{clamped}%"></span>
		{#if markerPercent !== null}
			<span
				class="ws-marker"
				style="left:{Math.max(0, Math.min(100, markerPercent))}%"
				title="{markerLabel} {markerPercent}%"
			></span>
		{/if}
	</div>
	<span>{valueLabel}</span>
</div>
{#if note}<p class="note text-muted">{note}</p>{/if}

<style>
	.note {
		font-size: 11px;
		margin: 3px 0 0;
	}
</style>
