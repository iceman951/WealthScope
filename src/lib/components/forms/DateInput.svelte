<script lang="ts">
	interface Props {
		id: string;
		name: string;
		value?: string;
		required?: boolean;
		invalid?: boolean;
		describedBy?: string;
		min?: string;
		max?: string;
	}

	let {
		id,
		name,
		value = '',
		required = false,
		invalid = false,
		describedBy,
		min,
		max
	}: Props = $props();
</script>

<input
	class="input"
	{id}
	{name}
	type="date"
	{required}
	{min}
	{max}
	aria-invalid={invalid ? 'true' : undefined}
	aria-describedby={describedBy}
	{value}
/>
