<script lang="ts">
	import { getFormatters } from '$lib/stores/formatting.svelte';
	import type { DecimalInput } from '$engine/money';

	/**
	 * Renders an exact amount using the user's base currency, locale and rounding
	 * preference. Rounding happens once, here, at the display boundary.
	 */
	interface Props {
		value: DecimalInput;
		/** Overrides the user's base currency for a row quoted in its own currency. */
		currency?: string;
		signed?: boolean;
		/** Colours gains and losses. The sign is always present regardless. */
		colored?: boolean;
		bare?: boolean;
		decimals?: number;
	}

	let {
		value,
		currency,
		signed = false,
		colored = false,
		bare = false,
		decimals
	}: Props = $props();

	const fmt = getFormatters();
	const text = $derived(fmt.money(value, { currency, signed, bare, decimals }));
	const direction = $derived(colored ? fmt.direction(value) : 'none');
</script>

<span class="amount" class:positive={direction === 'up'} class:negative={direction === 'down'}
	>{text}</span
>

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
