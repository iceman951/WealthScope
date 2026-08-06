<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * A small tinted label. `tone` never carries meaning on its own — the tag's
	 * text always says what the state is.
	 */
	interface Props {
		tone?: 'accent' | 'neutral' | 'outline';
		/** Renders the 6px accent square the design uses on the shell's status tag. */
		dot?: boolean;
		children: Snippet;
	}

	let { tone = 'neutral', dot = false, children }: Props = $props();
</script>

<span class="tag tag-{tone}" style={dot ? 'gap:6px' : undefined}>
	{#if dot}<span class="tag-dot" aria-hidden="true"></span>{/if}
	{@render children()}
</span>

<style>
	.tag-dot {
		width: 6px;
		height: 6px;
		background: var(--color-accent);
		display: block;
		flex: none;
	}
</style>
