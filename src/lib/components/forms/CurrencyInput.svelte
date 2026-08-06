<script lang="ts">
	import NumberInput from './NumberInput.svelte';

	/** A money field with the currency shown beside it, so the unit is never implied. */
	interface Props {
		id: string;
		name: string;
		currency: string;
		value?: string;
		required?: boolean;
		invalid?: boolean;
		describedBy?: string;
		placeholder?: string;
	}

	let {
		id,
		name,
		currency,
		value = '',
		required = false,
		invalid = false,
		describedBy,
		placeholder = '0'
	}: Props = $props();
</script>

<div class="wrap">
	<span class="code" aria-hidden="true">{currency}</span>
	<NumberInput {id} {name} {value} {required} {invalid} {describedBy} {placeholder} align="right" />
</div>

<style>
	.wrap {
		display: flex;
		align-items: stretch;
		border: 1px solid var(--color-divider);
		background: var(--color-surface);
	}
	.wrap :global(.input) {
		border: 0;
		background: transparent;
	}
	.wrap:focus-within {
		outline: 2px solid var(--color-accent);
		outline-offset: 0;
	}
	.code {
		display: flex;
		align-items: center;
		padding: 0 10px;
		font: 600 12px var(--font-body);
		letter-spacing: 0.06em;
		color: color-mix(in srgb, var(--color-text) 60%, transparent);
		border-right: 1px solid var(--color-divider);
		flex: none;
	}
</style>
