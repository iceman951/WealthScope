<script lang="ts" generics="Row">
	import type { Snippet } from 'svelte';
	import EmptyState from '../feedback/EmptyState.svelte';
	import type { Column } from './types';

	/**
	 * The design's data table.
	 *
	 * Narrow screens keep the table at a readable minimum width and scroll it
	 * horizontally rather than shrinking the type — financial figures stay legible.
	 */
	interface Props {
		caption: string;
		columns: readonly Column[];
		rows: readonly Row[];
		rowKey: (row: Row) => string;
		row: Snippet<[Row]>;
		foot?: Snippet;
		emptyTitle?: string;
		emptyDescription?: string;
		emptyActions?: Snippet;
	}

	let {
		caption,
		columns,
		rows,
		rowKey,
		row,
		foot,
		emptyTitle = 'Nothing here yet',
		emptyDescription = 'Records you add will appear in this table.',
		emptyActions
	}: Props = $props();
</script>

{#if rows.length === 0}
	<EmptyState title={emptyTitle} description={emptyDescription} level={4} actions={emptyActions} />
{:else}
	<div class="ws-scroll-x">
		<table class="table">
			<caption class="visually-hidden">{caption}</caption>
			<thead>
				<tr>
					{#each columns as column (column.key)}
						<th
							scope="col"
							class:num={column.align === 'right'}
							style={column.width ? `width:${column.width}` : undefined}
						>
							{column.header}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as item (rowKey(item))}
					{@render row(item)}
				{/each}
			</tbody>
			{#if foot}
				<tfoot>{@render foot()}</tfoot>
			{/if}
		</table>
	</div>
{/if}
