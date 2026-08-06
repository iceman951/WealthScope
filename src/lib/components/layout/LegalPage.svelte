<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Shared frame for the prerendered public documents. */
	interface Props {
		title: string;
		updated: string;
		children: Snippet;
	}

	let { title, updated, children }: Props = $props();
</script>

<svelte:head><title>{title} · WealthScope</title></svelte:head>

<div class="page">
	<header>
		<a class="brand" href="/">WealthScope</a>
		<a class="btn btn-secondary" href="/login">Sign in</a>
	</header>

	<main>
		<p class="kicker">Last updated {updated}</p>
		<h1>{title}</h1>
		<div class="prose">
			{@render children()}
		</div>
	</main>

	<footer>
		<a href="/">Home</a>
		<a href="/privacy">Privacy</a>
		<a href="/terms">Terms</a>
	</footer>
</div>

<style>
	.page {
		max-width: 760px;
		margin: 0 auto;
		padding: 0 var(--space-6);
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}
	header {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-4) 0;
		border-bottom: 2px solid var(--color-divider);
	}
	.brand {
		font-family: var(--font-heading);
		font-weight: 800;
		font-size: 19px;
		letter-spacing: -0.02em;
		margin-right: auto;
		text-decoration: none;
		color: inherit;
	}
	main {
		padding: var(--space-8) 0;
	}
	.kicker {
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--color-text) 55%, transparent);
	}
	h1 {
		font-size: var(--ws-display);
		margin-bottom: var(--space-6);
	}
	.prose :global(h2) {
		font-size: 18px;
		margin: var(--space-6) 0 var(--space-2);
		border-top: 2px solid var(--color-divider);
		padding-top: var(--space-4);
	}
	.prose :global(p),
	.prose :global(li) {
		font-size: 14px;
		max-width: 68ch;
	}
	.prose :global(ul) {
		padding-left: 1.1rem;
	}
	footer {
		margin-top: auto;
		border-top: 2px solid var(--color-divider);
		padding: var(--space-4) 0;
		display: flex;
		gap: var(--space-4);
		font-size: 12px;
	}
</style>
