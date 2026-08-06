<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$components/base/Button.svelte';
	import ChartFrame from '$components/charts/ChartFrame.svelte';
	import TrendChart from '$components/charts/TrendChart.svelte';
	import { getFormatters } from '$lib/stores/formatting.svelte';
	import { showToast } from '$lib/stores/toast.svelte';
	import {
		defaultMilestoneTargets,
		milestones,
		project,
		sampleProjection
	} from '$engine/projection';
	import { dec } from '$engine/money';
	import type { ActionData, PageData } from './$types';

	/**
	 * The sliders recompute a preview in the browser using the same pure engine the
	 * server uses. Nothing here is persisted — only the return and inflation
	 * assumptions can be saved, and that goes through a form action.
	 */

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const fmt = getFormatters();

	// Server values seed the sliders once; afterwards the sliders own the state.
	// svelte-ignore state_referenced_locally
	let contribution = $state(Math.max(0, Math.round(dec(data.monthlyNetFlow).toNumber())));
	// svelte-ignore state_referenced_locally
	let annualReturn = $state(data.defaults.annualReturnPercent);
	// svelte-ignore state_referenced_locally
	let inflation = $state(data.defaults.annualInflationPercent);
	let years = $state(25);
	let contributionGrowth = $state(0);
	let saving = $state(false);

	$effect(() => {
		if (form?.success === true) showToast(form.message);
	});

	const result = $derived(
		project({
			initialNetWorth: data.netWorth,
			monthlyContribution: contribution,
			annualReturnPercent: annualReturn,
			annualInflationPercent: inflation,
			contributionGrowthPercent: contributionGrowth,
			years
		})
	);

	const sampled = $derived(sampleProjection(result, 3));
	const nominal = $derived(sampled.map((p) => p.nominal.toNumber()));
	const real = $derived(sampled.map((p) => p.real.toNumber()));

	const axisLabels = $derived([
		'Now',
		String(data.currentYear + Math.round(years * 0.25)),
		String(data.currentYear + Math.round(years * 0.5)),
		String(data.currentYear + Math.round(years * 0.75)),
		String(data.currentYear + years)
	]);

	const targets = $derived(defaultMilestoneTargets(dec(data.netWorth)));
	const reached = $derived(
		milestones(result, targets, { startYear: data.currentYear, birthYear: data.birthYear })
	);

	const retirementYear = $derived(
		data.birthYear && data.retirementAge ? data.birthYear + data.retirementAge : null
	);
</script>

<div class="ws-grid ws-grid--flush ws-grid--side">
	<div class="ws-pad ws-scroll-x">
		<ChartFrame
			title="Projected net worth"
			meta="Solid: nominal · dashed: in today's money"
			summary="Starting from {fmt.money(data.netWorth)}, contributing {fmt.money(
				contribution
			)} a month at {annualReturn}% nominal, the projection reaches {fmt.money(
				result.endingNominal
			)} after {years} years — {fmt.money(result.endingReal)} in today's money."
			height="300px"
		>
			<TrendChart
				series={[
					{ values: nominal, stroke: 'var(--color-accent)', width: 2.5 },
					{ values: real, stroke: 'var(--color-text)', width: 2, dashed: true }
				]}
				height={300}
				gridLines={4}
				labels={axisLabels}
			/>

			{#snippet alternative()}
				<table class="table">
					<caption class="visually-hidden">Projected net worth by year</caption>
					<thead>
						<tr>
							<th scope="col">Year</th>
							<th scope="col" class="num">Nominal</th>
							<th scope="col" class="num">In today's money</th>
							<th scope="col" class="num">Contributed to date</th>
						</tr>
					</thead>
					<tbody>
						{#each result.points.filter((p) => p.monthIndex % 12 === 0) as point (point.monthIndex)}
							<tr>
								<td class="num">{data.currentYear + point.monthIndex / 12}</td>
								<td class="num">{fmt.money(point.nominal)}</td>
								<td class="num">{fmt.money(point.real)}</td>
								<td class="num">{fmt.money(point.contributedToDate)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/snippet}
		</ChartFrame>

		<div class="ws-grid ws-grid--4 ws-grid--flush stats">
			<div>
				<div class="ws-kicker">Nominal at horizon</div>
				<div class="ws-value ws-value--fixed-lg">{fmt.money(result.endingNominal)}</div>
			</div>
			<div>
				<div class="ws-kicker">In today's money</div>
				<div class="ws-value ws-value--fixed-lg">{fmt.money(result.endingReal)}</div>
			</div>
			<div>
				<div class="ws-kicker">Contributions</div>
				<div class="ws-value ws-value--fixed-lg">{fmt.money(result.totalContributions)}</div>
			</div>
			<div>
				<div class="ws-kicker">Growth</div>
				<div class="ws-value ws-value--fixed-lg">{fmt.money(result.growth)}</div>
			</div>
		</div>

		<div class="ws-rule-top">
			<h5>Milestones</h5>
			<table class="table">
				<caption class="visually-hidden">Projected milestones</caption>
				<thead>
					<tr>
						<th scope="col">Target</th>
						<th scope="col" class="num">Reached</th>
						<th scope="col" class="num">Age</th>
						<th scope="col" class="num">In today's money</th>
					</tr>
				</thead>
				<tbody>
					{#each reached as milestone (milestone.target.toString())}
						<tr>
							<td class="strong">{fmt.money(milestone.target)}</td>
							<td class="num">{milestone.calendarYear ?? `Beyond ${years} years`}</td>
							<td class="num">
								{milestone.ageAtMilestone ?? (data.birthYear ? '—' : 'Set your birth year')}
							</td>
							<td class="num">
								{milestone.realValueThen ? fmt.money(milestone.realValueThen) : '—'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if retirementYear}
				<p class="text-muted small">
					Your target retirement year is {retirementYear}. At the current assumptions the projection
					reaches
					{fmt.money(
						result.points.find(
							(p) =>
								p.monthIndex ===
								Math.min((retirementYear - data.currentYear) * 12, result.points.length - 1)
						)?.nominal ?? result.endingNominal
					)} by then.
				</p>
			{/if}
		</div>
	</div>

	<div class="ws-pad">
		<h5>Assumptions</h5>

		<div class="sliders">
			<div class="slider">
				<label for="contribution">
					<span>Monthly contribution</span>
					<span class="num strong">{fmt.money(contribution)}</span>
				</label>
				<input
					id="contribution"
					type="range"
					min="0"
					max={Math.max(20000, contribution * 2)}
					step="100"
					bind:value={contribution}
				/>
			</div>

			<div class="slider">
				<label for="return">
					<span>Nominal annual return</span>
					<span class="num strong">{annualReturn.toFixed(1)}%</span>
				</label>
				<input id="return" type="range" min="0" max="12" step="0.1" bind:value={annualReturn} />
			</div>

			<div class="slider">
				<label for="inflation">
					<span>Inflation</span>
					<span class="num strong">{inflation.toFixed(1)}%</span>
				</label>
				<input id="inflation" type="range" min="0" max="8" step="0.1" bind:value={inflation} />
			</div>

			<div class="slider">
				<label for="growth">
					<span>Contribution grows by</span>
					<span class="num strong">{contributionGrowth.toFixed(1)}% / yr</span>
				</label>
				<input
					id="growth"
					type="range"
					min="0"
					max="10"
					step="0.5"
					bind:value={contributionGrowth}
				/>
			</div>

			<div class="slider">
				<label for="years">
					<span>Horizon</span>
					<span class="num strong">{years} years</span>
				</label>
				<input id="years" type="range" min="5" max="40" step="1" bind:value={years} />
			</div>
		</div>

		<div class="hr"></div>

		<div class="ws-kv"><span>Starting net worth</span><span>{fmt.money(data.netWorth)}</span></div>
		<div class="ws-kv"><span>Compounding</span><span>Monthly</span></div>
		<div class="ws-kv">
			<span>Current net monthly flow</span><span
				>{fmt.money(data.monthlyNetFlow, { signed: true })}</span
			>
		</div>

		<form
			method="POST"
			action="?/saveAssumptions"
			use:enhance={() => {
				saving = true;
				return async ({ update }) => {
					await update({ reset: false });
					saving = false;
				};
			}}
		>
			<input type="hidden" name="monthlyContribution" value={contribution} />
			<input type="hidden" name="annualReturnPercent" value={annualReturn} />
			<input type="hidden" name="annualInflationPercent" value={inflation} />
			<input type="hidden" name="contributionGrowthPercent" value={contributionGrowth} />
			<input type="hidden" name="years" value={years} />
			<Button variant="secondary" type="submit" block pending={saving} pendingLabel="Saving…">
				Save return &amp; inflation as defaults
			</Button>
		</form>

		<p class="text-muted disclaimer">
			This is arithmetic on the assumptions above, not a forecast. It is not advice and it is not a
			guarantee: real returns vary, can be negative, and no sequence of them is predictable. The
			sliders change only this preview — nothing is saved unless you press the button.
		</p>
	</div>
</div>

<style>
	h5 {
		margin: 0 0 var(--space-4);
	}
	.stats {
		margin-top: var(--space-6);
		border-top: 2px solid var(--color-divider);
		padding-top: var(--space-4);
		gap: var(--space-4);
		background: transparent;
	}
	.stats > :global(*) {
		background: transparent;
	}
	.strong {
		font-weight: 600;
	}
	.sliders {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.slider label {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		margin-bottom: 6px;
		gap: var(--space-2);
	}
	.slider input[type='range'] {
		width: 100%;
		accent-color: var(--color-accent);
	}
	.small {
		font-size: 11.5px;
		margin-top: var(--space-3);
	}
	.disclaimer {
		font-size: 11.5px;
		margin-top: var(--space-4);
		border-top: 2px solid var(--color-divider);
		padding-top: var(--space-3);
	}
</style>
