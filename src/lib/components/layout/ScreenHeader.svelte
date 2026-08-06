<script lang="ts">
	import type { Snippet } from 'svelte';

	/** The header bar: menu toggle, title/subtitle, status tag and the two actions. */
	interface Props {
		title: string;
		subtitle: string;
		onmenu: () => void;
		navOpen: boolean;
		status?: Snippet;
		actions?: Snippet;
	}

	let { title, subtitle, onmenu, navOpen, status, actions }: Props = $props();
</script>

<header class="header">
	<button
		type="button"
		class="btn btn-secondary menu"
		onclick={onmenu}
		aria-expanded={navOpen}
		aria-controls="primary-navigation"
	>
		Menu
	</button>

	<div class="titles">
		<h1>{title}</h1>
		<p>{subtitle}</p>
	</div>

	{#if status}<div class="status">{@render status()}</div>{/if}
	{#if actions}<div class="ws-row actions">{@render actions()}</div>{/if}
</header>

<style>
	.header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-6);
		border-bottom: 2px solid var(--color-divider);
		flex: none;
		flex-wrap: wrap;
	}
	.menu {
		display: none;
		padding: 6px 10px;
		flex: none;
		min-height: 32px;
	}
	.titles {
		margin-right: auto;
		min-width: 0;
	}
	h1 {
		font-family: var(--font-heading);
		font-weight: 800;
		font-size: 17px;
		letter-spacing: -0.01em;
		margin: 0;
		line-height: 1.2;
	}
	p {
		font-size: 11px;
		color: color-mix(in srgb, var(--color-text) 55%, transparent);
		margin: 0;
	}
	.actions {
		flex-wrap: nowrap;
	}

	@media (max-width: 900px) {
		.menu {
			display: inline-flex;
		}
		h1 {
			font-size: 15px;
		}
		.status {
			display: none;
		}
		.actions {
			flex-wrap: wrap;
		}
	}
</style>
