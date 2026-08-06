<script lang="ts">
	import { onMount } from 'svelte';
	import ChartFrame from './ChartFrame.svelte';

	/**
	 * The one screen that earns Apache ECharts: an interactive heatmap with a
	 * continuous visual map and per-cell tooltips.
	 *
	 * ECharts is imported dynamically, after mount, and only the four modules the
	 * heatmap needs — it never reaches the dashboard bundle and never runs on the
	 * server, so there is nothing to hydrate and no SSR mismatch.
	 */
	interface Props {
		labels: readonly string[];
		/** [row, column, value | null]; null means not enough overlapping history. */
		cells: readonly (readonly [number, number, number | null])[];
		complete: boolean;
	}

	let { labels, cells, complete }: Props = $props();

	let container = $state<HTMLDivElement | null>(null);
	let status = $state<'loading' | 'ready' | 'error' | 'empty'>('loading');

	onMount(() => {
		if (labels.length < 2) {
			status = 'empty';
			return;
		}

		let chart: { setOption: (o: unknown) => void; resize: () => void; dispose: () => void } | null =
			null;
		let observer: ResizeObserver | null = null;
		let cancelled = false;

		(async () => {
			try {
				const [core, charts, components, renderers] = await Promise.all([
					import('echarts/core'),
					import('echarts/charts'),
					import('echarts/components'),
					import('echarts/renderers')
				]);

				core.use([
					charts.HeatmapChart,
					components.TooltipComponent,
					components.GridComponent,
					components.VisualMapComponent,
					renderers.SVGRenderer
				]);

				if (cancelled || !container) return;

				chart = core.init(container, undefined, { renderer: 'svg' });
				chart.setOption({
					animation: false,
					tooltip: {
						position: 'top',
						formatter: (params: { data: [number, number, number | null] }) => {
							const [x, y, value] = params.data;
							if (value === null) return `${labels[y]} / ${labels[x]}<br/>Not enough history`;
							return `${labels[y]} / ${labels[x]}<br/>${value.toFixed(2)}`;
						}
					},
					grid: { left: 90, right: 12, top: 28, bottom: 40, containLabel: false },
					xAxis: { type: 'category', data: [...labels], splitArea: { show: true } },
					yAxis: { type: 'category', data: [...labels], splitArea: { show: true } },
					visualMap: {
						min: -1,
						max: 1,
						calculable: false,
						orient: 'horizontal',
						left: 'center',
						bottom: 0,
						text: ['Moves together', 'Moves apart'],
						inRange: { color: ['#f8f4f4', '#ffc4b8', '#ec3013'] }
					},
					series: [
						{
							type: 'heatmap',
							data: cells.map(([x, y, v]) => [x, y, v]),
							label: {
								show: true,
								formatter: (params: { data: [number, number, number | null] }) =>
									params.data[2] === null ? '—' : params.data[2].toFixed(2)
							},
							emphasis: { itemStyle: { borderColor: '#201e1d', borderWidth: 2 } }
						}
					]
				});

				observer = new ResizeObserver(() => chart?.resize());
				if (container) observer.observe(container);
				status = 'ready';
			} catch {
				status = 'error';
			}
		})();

		return () => {
			cancelled = true;
			observer?.disconnect();
			chart?.dispose();
		};
	});
</script>

<ChartFrame
	title="Correlation matrix — monthly returns"
	summary="Correlation of monthly returns between holdings. The table below carries the same figures."
	{status}
	height="380px"
	emptyMessage="At least two holdings with recorded price history are needed to compute correlations."
	errorMessage="The correlation chart could not be loaded. The table below has the same figures."
>
	<div class="heatmap" bind:this={container}></div>

	{#snippet alternative()}
		<table class="table">
			<caption class="visually-hidden">Correlation of monthly returns between holdings</caption>
			<thead>
				<tr>
					<th scope="col">Holding</th>
					{#each labels as label (label)}<th scope="col" class="num">{label}</th>{/each}
				</tr>
			</thead>
			<tbody>
				{#each labels as rowLabel, y (rowLabel)}
					<tr>
						<th scope="row">{rowLabel}</th>
						{#each labels as _, x (x)}
							{@const cell = cells.find((c) => c[0] === x && c[1] === y)}
							<td class="num"
								>{cell?.[2] === null || cell === undefined ? '—' : cell[2].toFixed(2)}</td
							>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	{/snippet}

	{#snippet footer()}
		{#if !complete}
			<p class="text-muted note">
				Cells marked — do not have enough overlapping price history. The diversification score is
				marked low-confidence while that is true.
			</p>
		{/if}
	{/snippet}
</ChartFrame>

<style>
	.heatmap {
		width: 100%;
		height: 380px;
	}
	.note {
		font-size: 11.5px;
		max-width: 70ch;
		margin: var(--space-3) 0 0;
	}
</style>
