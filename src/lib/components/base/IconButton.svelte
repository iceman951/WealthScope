<script lang="ts">
	import type { Snippet } from 'svelte';

	/** A square action carrying only an icon, so it always names itself for AT. */
	interface Props {
		label: string;
		variant?: 'secondary' | 'ghost';
		onclick?: (event: MouseEvent) => void;
		type?: 'button' | 'submit';
		disabled?: boolean;
		children: Snippet;
	}

	let {
		label,
		variant = 'ghost',
		onclick,
		type = 'button',
		disabled = false,
		children
	}: Props = $props();
</script>

<button
	{type}
	class="btn btn-{variant} btn-icon"
	aria-label={label}
	title={label}
	{disabled}
	{onclick}
>
	{@render children()}
</button>
