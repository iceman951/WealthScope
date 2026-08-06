<script lang="ts">
	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		id: string;
		name: string;
		options: readonly Option[];
		value?: string;
		required?: boolean;
		invalid?: boolean;
		describedBy?: string;
		placeholder?: string;
		onchange?: (event: Event) => void;
	}

	let {
		id,
		name,
		options,
		value = '',
		required = false,
		invalid = false,
		describedBy,
		placeholder,
		onchange
	}: Props = $props();
</script>

<select
	class="input"
	{id}
	{name}
	{required}
	{onchange}
	aria-invalid={invalid ? 'true' : undefined}
	aria-describedby={describedBy}
>
	{#if placeholder}
		<option value="" selected={value === ''}>{placeholder}</option>
	{/if}
	{#each options as option (option.value)}
		<option value={option.value} selected={option.value === value}>{option.label}</option>
	{/each}
</select>
