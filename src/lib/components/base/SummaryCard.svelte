<script lang="ts">
	import type { Snippet } from 'svelte';

	/** A padded panel with a heading — the side column throughout the design. */
	interface Props {
		title?: string;
		/** h4 for a primary panel, h5 for a secondary one. Keeps the outline correct. */
		level?: 4 | 5;
		meta?: string;
		scroll?: boolean;
		children: Snippet;
		actions?: Snippet;
	}

	let { title, level = 5, meta, scroll = false, children, actions }: Props = $props();
</script>

<section class="ws-pad" class:ws-scroll-x={scroll}>
	{#if title}
		<div class="ws-section-head">
			{#if level === 4}
				<h4>{title}</h4>
			{:else}
				<h5>{title}</h5>
			{/if}
			{#if meta}<span class="text-muted">{meta}</span>{/if}
			{#if actions}<div class="ws-row ws-row--end">{@render actions()}</div>{/if}
		</div>
	{/if}
	{@render children()}
</section>
