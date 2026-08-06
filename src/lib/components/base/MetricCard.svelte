<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Kicker + big figure + note. The unit of the summary strips across the design.
	 * The strip itself supplies the 2px rules; this is one cell inside it.
	 */
	interface Props {
		label: string;
		/** Rendered as text so an exact Decimal string is never re-parsed. */
		value: string;
		note?: string;
		noteTone?: 'muted' | 'accent';
		size?: 'default' | 'sm' | 'md' | 'lg' | 'xl';
		padding?: 'default' | 'tight';
		children?: Snippet;
	}

	let {
		label,
		value,
		note,
		noteTone = 'muted',
		size = 'default',
		padding = 'default',
		children
	}: Props = $props();

	const valueClass = $derived(size === 'default' ? 'ws-value' : `ws-value ws-value--${size}`);
</script>

<div class={padding === 'tight' ? 'ws-pad--tight' : 'ws-pad'}>
	<div class="ws-kicker">{label}</div>
	<div class={valueClass}>{value}</div>
	{#if note}
		<div class="ws-sub" class:ws-sub--accent={noteTone === 'accent'}>{note}</div>
	{/if}
	{@render children?.()}
</div>
