<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ href: '/analyze/overview', label: 'Overview & findings' },
		{ href: '/analyze/risk', label: 'Risk' },
		{ href: '/analyze/projection', label: 'Projection' }
	];
</script>

<nav class="ws-tabs" aria-label="Analysis sections">
	{#each tabs as tab (tab.href)}
		<a
			class="ws-tab"
			href={tab.href}
			aria-current={page.url.pathname === tab.href ? 'page' : undefined}
		>
			{tab.label}
		</a>
	{/each}
</nav>

{@render children()}
