<script lang="ts">
	/** Server-side pagination as plain links, so it works without JavaScript. */
	interface Props {
		page: number;
		pageSize: number;
		total: number;
		/** Builds the href for a page number, preserving any other query state. */
		hrefFor: (page: number) => string;
	}

	let { page, pageSize, total, hrefFor }: Props = $props();

	const pageCount = $derived(Math.max(1, Math.ceil(total / pageSize)));
	const first = $derived(total === 0 ? 0 : (page - 1) * pageSize + 1);
	const last = $derived(Math.min(page * pageSize, total));
</script>

{#if pageCount > 1}
	<nav class="pagination" aria-label="Pagination">
		<p class="text-muted">
			Showing <span class="num">{first}</span>–<span class="num">{last}</span> of
			<span class="num">{total}</span>
		</p>
		<div class="ws-row">
			<a
				class="ws-chip"
				href={hrefFor(page - 1)}
				aria-disabled={page <= 1}
				tabindex={page <= 1 ? -1 : undefined}>Previous</a
			>
			<span class="ws-chip current" aria-current="true">Page {page} of {pageCount}</span>
			<a
				class="ws-chip"
				href={hrefFor(page + 1)}
				aria-disabled={page >= pageCount}
				tabindex={page >= pageCount ? -1 : undefined}>Next</a
			>
		</div>
	</nav>
{/if}

<style>
	.pagination {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		flex-wrap: wrap;
		margin-top: var(--space-4);
		padding-top: var(--space-3);
		border-top: 2px solid var(--color-divider);
	}
	p {
		margin: 0;
		font-size: 12px;
	}
	.pagination .ws-row {
		margin-left: auto;
	}
	a[aria-disabled='true'] {
		opacity: 0.45;
		pointer-events: none;
	}
	.current {
		cursor: default;
	}
</style>
