<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	/**
	 * The design's action. Labels are flush left inside a wide button (`block`),
	 * centred otherwise — the Modernist rule.
	 */
	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

	interface Props {
		variant?: Variant;
		href?: string;
		type?: 'button' | 'submit' | 'reset';
		block?: boolean;
		disabled?: boolean;
		/** Shows a pending label and blocks a second submit. */
		pending?: boolean;
		pendingLabel?: string;
		children: Snippet;
		class?: string;
		onclick?: (event: MouseEvent) => void;
		rest?: HTMLButtonAttributes & HTMLAnchorAttributes;
	}

	let {
		variant = 'secondary',
		href,
		type = 'button',
		block = false,
		disabled = false,
		pending = false,
		pendingLabel = 'Working…',
		children,
		class: className = '',
		onclick,
		...rest
	}: Props = $props();

	const classes = $derived(
		['btn', `btn-${variant}`, block ? 'btn-block' : '', className].filter(Boolean).join(' ')
	);
</script>

{#if href}
	<a {href} class={classes} aria-disabled={disabled ? 'true' : undefined} {...rest}>
		{@render children()}
	</a>
{:else}
	<button
		{type}
		class={classes}
		disabled={disabled || pending}
		aria-busy={pending ? 'true' : undefined}
		{onclick}
		{...rest}
	>
		{#if pending}{pendingLabel}{:else}{@render children()}{/if}
	</button>
{/if}
