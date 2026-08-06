<script lang="ts">
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import type { Snippet } from 'svelte';
	import Toast from '../feedback/Toast.svelte';
	import ScreenHeader from './ScreenHeader.svelte';
	import Sidebar from './Sidebar.svelte';
	import StatusTag from '../base/StatusTag.svelte';
	import { screenFor } from './navigation';

	/**
	 * The two-column application shell: a fixed 236px navigation rail and a
	 * scrolling main column, collapsing to an off-canvas drawer under 900px.
	 */
	interface Props {
		recordCount: number;
		lastUpdated: string;
		baseCurrency: string;
		children: Snippet;
	}

	let { recordCount, lastUpdated, baseCurrency, children }: Props = $props();

	let navOpen = $state(false);

	const screen = $derived(
		screenFor(page.url.pathname) ?? {
			title: 'WealthScope',
			subtitle: 'Personal wealth analysis',
			label: '',
			href: '/dashboard'
		}
	);

	// A drawer left open across a navigation would cover the page it just opened.
	afterNavigate(() => {
		navOpen = false;
	});
</script>

<svelte:head>
	<title>{screen.title} · WealthScope</title>
</svelte:head>

<a class="skip-link" href="#main-content">Skip to content</a>

<div class="shell">
	<Sidebar open={navOpen} onnavigate={() => (navOpen = false)} {recordCount} {lastUpdated} />

	{#if navOpen}
		<button
			type="button"
			class="backdrop"
			aria-label="Close navigation"
			onclick={() => (navOpen = false)}
		></button>
	{/if}

	<main class="main">
		<ScreenHeader
			title={screen.title}
			subtitle={screen.subtitle}
			{navOpen}
			onmenu={() => (navOpen = !navOpen)}
		>
			{#snippet status()}
				<StatusTag dot>Base currency {baseCurrency}</StatusTag>
			{/snippet}
			{#snippet actions()}
				<a class="btn btn-secondary" href="/import">Import CSV</a>
				<a class="btn btn-primary" href="/reports">Export report</a>
			{/snippet}
		</ScreenHeader>

		<div class="scroll" id="main-content" tabindex="-1">
			{@render children()}
		</div>
	</main>
</div>

<Toast />

<style>
	.shell {
		display: grid;
		grid-template-columns: var(--ws-sidebar) 1fr;
		grid-template-areas: 'sidebar main';
		height: 100dvh;
		background: var(--color-bg);
		color: var(--color-text);
	}
	.main {
		grid-area: main;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		position: relative;
		min-width: 0;
	}
	.scroll {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
	}
	.scroll:focus {
		outline: none;
	}
	.backdrop {
		position: fixed;
		inset: 0;
		background: color-mix(in srgb, var(--color-neutral-900) 45%, transparent);
		z-index: 50;
		border: 0;
		padding: 0;
		cursor: pointer;
	}

	@media (max-width: 900px) {
		.shell {
			grid-template-columns: 1fr;
			grid-template-areas: 'main';
		}
	}

	@media print {
		.shell {
			display: block;
			height: auto;
		}
		.scroll {
			overflow: visible;
		}
	}
</style>
