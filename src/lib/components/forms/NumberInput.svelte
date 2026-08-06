<script lang="ts">
	/**
	 * A numeric field kept as `inputmode="decimal"` text rather than `type=number`.
	 *
	 * `type=number` silently drops what it cannot parse and rounds through a
	 * float — neither is acceptable for money. The exact string is submitted and
	 * the server parses it into a Decimal.
	 */
	interface Props {
		id: string;
		name: string;
		value?: string;
		placeholder?: string;
		required?: boolean;
		invalid?: boolean;
		describedBy?: string;
		align?: 'left' | 'right';
		oninput?: (event: Event) => void;
	}

	let {
		id,
		name,
		value = '',
		placeholder = '0',
		required = false,
		invalid = false,
		describedBy,
		align = 'left',
		oninput
	}: Props = $props();
</script>

<input
	class="input num"
	style={align === 'right' ? 'text-align:right' : undefined}
	{id}
	{name}
	type="text"
	inputmode="decimal"
	{placeholder}
	{required}
	{oninput}
	aria-invalid={invalid ? 'true' : undefined}
	aria-describedby={describedBy}
	{value}
/>

<style>
	.num {
		font-variant-numeric: tabular-nums;
	}
</style>
