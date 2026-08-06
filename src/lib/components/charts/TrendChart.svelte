<script lang="ts">
	/**
	 * The net-worth and projection line, drawn as inline SVG.
	 *
	 * A `viewBox` with `preserveAspectRatio="none"` makes it resize with the column
	 * at a fixed pixel height, so there is no resize observer, no layout shift and
	 * nothing to hydrate.
	 */
	interface Series {
		/** Plain numbers: these are coordinates, not money. */
		values: number[];
		stroke: string;
		dashed?: boolean;
		width?: number;
	}

	interface Props {
		series: readonly Series[];
		/** Filled area under the first series. */
		area?: boolean;
		height?: number;
		gridLines?: number;
		labels?: readonly string[];
	}

	let { series, area = true, height = 220, gridLines = 3, labels = [] }: Props = $props();

	const WIDTH = 960;

	const bounds = $derived.by(() => {
		const all = series.flatMap((s) => s.values);
		if (all.length === 0) return { min: 0, max: 1 };
		const min = Math.min(...all);
		const max = Math.max(...all);
		if (min === max) return { min: min - 1, max: max + 1 };
		// Headroom above and a little below, as the design's chart has.
		return { min: Math.min(min * 0.94, min), max: max * 1.03 };
	});

	function path(values: number[], close: boolean): string {
		if (values.length === 0) return '';
		const h = height - 1;
		const x = (i: number) => (values.length === 1 ? 0 : (i / (values.length - 1)) * WIDTH);
		const y = (v: number) => h - ((v - bounds.min) / (bounds.max - bounds.min)) * (h - 6) - 3;

		let d = `M ${x(0).toFixed(1)} ${y(values[0]).toFixed(1)}`;
		for (let i = 1; i < values.length; i++) {
			d += ` L ${x(i).toFixed(1)} ${y(values[i]).toFixed(1)}`;
		}
		if (close) d += ` L ${WIDTH} ${h} L 0 ${h} Z`;
		return d;
	}

	const gridYs = $derived(
		Array.from({ length: gridLines }, (_, i) => Math.round((i * (height - 1)) / gridLines))
	);
</script>

<svg
	viewBox="0 0 {WIDTH} {height}"
	preserveAspectRatio="none"
	style="width:100%;height:{height}px;display:block"
	aria-hidden="true"
	focusable="false"
>
	{#each gridYs as gy (gy)}
		<line x1="0" y1={gy} x2={WIDTH} y2={gy} stroke="var(--color-neutral-300)" stroke-width="1" />
	{/each}
	<line
		x1="0"
		y1={height - 1}
		x2={WIDTH}
		y2={height - 1}
		stroke="var(--color-text)"
		stroke-width="2"
	/>

	{#if area && series[0]}
		<path d={path(series[0].values, true)} fill="var(--color-accent-200)" />
	{/if}

	{#each series as line, i (i)}
		<path
			d={path(line.values, false)}
			fill="none"
			stroke={line.stroke}
			stroke-width={line.width ?? 2.5}
			stroke-dasharray={line.dashed ? '7 5' : undefined}
			vector-effect="non-scaling-stroke"
		/>
	{/each}
</svg>

{#if labels.length > 0}
	<div class="axis">
		{#each labels as label (label)}<span>{label}</span>{/each}
	</div>
{/if}

<style>
	.axis {
		display: flex;
		justify-content: space-between;
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--color-text) 50%, transparent);
		margin-top: 6px;
	}
</style>
