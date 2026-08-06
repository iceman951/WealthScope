<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * The zero-data state. Says what is missing and offers the ways out, exactly as
	 * the design's "No records yet" screen does.
	 */
	interface Props {
		title: string;
		description: string;
		/** h2 on a full screen, h4 inside a panel. */
		level?: 2 | 4;
		actions?: Snippet;
	}

	let { title, description, level = 2, actions }: Props = $props();
</script>

<div class="empty">
	{#if level === 2}
		<h2>{title}</h2>
	{:else}
		<h4>{title}</h4>
	{/if}
	<p class="text-muted">{description}</p>
	{#if actions}
		<div class="ws-row actions">{@render actions()}</div>
	{/if}
</div>

<style>
	.empty {
		padding: var(--space-8) var(--space-6);
		max-width: 720px;
	}
	h2,
	h4 {
		margin-bottom: var(--space-2);
	}
	p {
		font-size: 14px;
		max-width: 60ch;
	}
	.actions {
		margin-top: var(--space-4);
	}
</style>
