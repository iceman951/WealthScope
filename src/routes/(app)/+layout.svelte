<script lang="ts">
	import type { Snippet } from 'svelte';
	import AppShell from '$components/layout/AppShell.svelte';
	import { provideFormatters } from '$lib/stores/formatting.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	// Server settings are read through context via a getter, so there is one source
	// of truth — the layout's page data — and no copy in a global store.
	provideFormatters(() => data.settings);

	const lastUpdated = $derived(
		data.summary.lastUpdated
			? new Intl.DateTimeFormat(data.settings.locale, {
					day: 'numeric',
					month: 'short',
					year: 'numeric'
				}).format(new Date(data.summary.lastUpdated))
			: 'No records yet'
	);
</script>

<AppShell
	recordCount={data.summary.recordCount}
	{lastUpdated}
	baseCurrency={data.settings.baseCurrency}
>
	{@render children()}
</AppShell>
