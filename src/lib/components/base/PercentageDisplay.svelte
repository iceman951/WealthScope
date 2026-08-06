<script lang="ts">
	import { formatOptionalPercent, NO_DATA, type Decimal } from '$engine/money';

	/**
	 * A percentage, or an em dash when the value could not be computed. Never a
	 * zero standing in for "unknown".
	 */
	interface Props {
		value: Decimal | null | undefined;
		decimals?: number;
		signed?: boolean;
		colored?: boolean;
		/** Shown to assistive tech in place of the dash. */
		emptyLabel?: string;
	}

	let {
		value,
		decimals = 1,
		signed = false,
		colored = false,
		emptyLabel = 'Not enough data'
	}: Props = $props();

	const text = $derived(formatOptionalPercent(value, { decimals, signed }));
	const isEmpty = $derived(text === NO_DATA);
	const direction = $derived(
		!colored || value === null || value === undefined || value.isZero()
			? 'none'
			: value.isNegative()
				? 'down'
				: 'up'
	);
</script>

{#if isEmpty}
	<span class="amount text-muted" title={emptyLabel}>
		{NO_DATA}<span class="visually-hidden">{emptyLabel}</span>
	</span>
{:else}
	<span class="amount" class:positive={direction === 'up'} class:negative={direction === 'down'}
		>{text}</span
	>
{/if}

<style>
	.amount {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.positive {
		color: var(--color-positive);
	}
	.negative {
		color: var(--color-negative);
	}
</style>
