<script lang="ts">
	interface Props {
		id: string;
		name: string;
		value?: string;
		type?: 'text' | 'email' | 'password' | 'search' | 'url';
		placeholder?: string;
		autocomplete?: string;
		required?: boolean;
		readonly?: boolean;
		invalid?: boolean;
		describedBy?: string;
		maxlength?: number;
		oninput?: (event: Event) => void;
	}

	let {
		id,
		name,
		value = '',
		type = 'text',
		placeholder,
		autocomplete,
		required = false,
		readonly = false,
		invalid = false,
		describedBy,
		maxlength,
		oninput
	}: Props = $props();
</script>

<input
	class="input"
	{id}
	{name}
	{type}
	{placeholder}
	{required}
	{readonly}
	{maxlength}
	{oninput}
	autocomplete={autocomplete as HTMLInputElement['autocomplete']}
	aria-invalid={invalid ? 'true' : undefined}
	aria-describedby={describedBy}
	{value}
/>
