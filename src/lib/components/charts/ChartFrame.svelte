<script lang="ts">
	import type { Snippet } from 'svelte';
	import EmptyState from '../feedback/EmptyState.svelte';
	import ErrorMessage from '../feedback/ErrorMessage.svelte';
	import LoadingSkeleton from '../feedback/LoadingSkeleton.svelte';

	/**
	 * Wraps every chart with its four states and its accessible equivalent.
	 *
	 * A chart is decoration for a screen reader, so `summary` (and optionally a
	 * table under `alternative`) carries the same information in text.
	 */
	interface Props {
		title: string;
		meta?: string;
		/** Read out in place of the graphic. */
		summary: string;
		status?: 'ready' | 'loading' | 'empty' | 'error';
		emptyMessage?: string;
		errorMessage?: string;
		height?: string;
		children: Snippet;
		/** A table equivalent, revealed by the "Show as table" toggle. */
		alternative?: Snippet;
		footer?: Snippet;
	}

	let {
		title,
		meta,
		summary,
		status = 'ready',
		emptyMessage = 'There is nothing to plot yet.',
		errorMessage = 'This chart could not be drawn.',
		height = '220px',
		children,
		alternative,
		footer
	}: Props = $props();

	let showTable = $state(false);
</script>

<figure class="frame">
	<figcaption class="ws-section-head">
		<h4>{title}</h4>
		{#if meta}<span class="text-muted">{meta}</span>{/if}
		{#if alternative}
			<button
				type="button"
				class="btn btn-ghost toggle"
				aria-expanded={showTable}
				onclick={() => (showTable = !showTable)}
			>
				{showTable ? 'Hide table' : 'Show as table'}
			</button>
		{/if}
	</figcaption>

	{#if status === 'loading'}
		<div style="height:{height}"><LoadingSkeleton variant="chart" label="Drawing {title}" /></div>
	{:else if status === 'error'}
		<ErrorMessage message={errorMessage} />
	{:else if status === 'empty'}
		<EmptyState title="Not enough data" description={emptyMessage} level={4} />
	{:else}
		<div class="plot" style="min-height:{height}" role="img" aria-label={summary}>
			{@render children()}
		</div>
		<p class="visually-hidden">{summary}</p>
	{/if}

	{#if footer}<div class="footer">{@render footer()}</div>{/if}

	{#if alternative && showTable}
		<div class="alt ws-scroll-x">{@render alternative()}</div>
	{/if}
</figure>

<style>
	.frame {
		margin: 0;
		display: flex;
		flex-direction: column;
	}
	.frame h4 {
		margin: 0;
	}
	.toggle {
		margin-left: auto;
		font-size: 12px;
	}
	.ws-section-head .text-muted + .toggle {
		margin-left: var(--space-3);
	}
	.plot {
		width: 100%;
	}
	.footer {
		margin-top: 6px;
	}
	.alt {
		margin-top: var(--space-4);
		border-top: 2px solid var(--color-divider);
		padding-top: var(--space-3);
	}
</style>
