<script lang="ts">
	import { page } from '$app/state';

	const title = $derived(
		page.status === 404
			? 'That page does not exist'
			: page.status === 401
				? 'You need to sign in'
				: page.status === 403
					? 'You do not have access to that'
					: 'Something went wrong'
	);
</script>

<svelte:head><title>{title} · WealthScope</title></svelte:head>

<div class="wrap">
	<p class="kicker">Error {page.status}</p>
	<h1>{title}</h1>
	<p class="body">{page.error?.message ?? 'An unexpected error occurred.'}</p>

	{#if page.error?.code}
		<p class="code">
			Reference <strong>{page.error.code}</strong> — quote this if you get in touch.
		</p>
	{/if}

	<div class="ws-row actions">
		<a class="btn btn-primary" href="/dashboard">Back to the dashboard</a>
		{#if page.status === 401}
			<a class="btn btn-secondary" href="/login">Sign in</a>
		{:else}
			<button type="button" class="btn btn-secondary" onclick={() => location.reload()}>
				Try again
			</button>
		{/if}
	</div>
</div>

<style>
	.wrap {
		max-width: 640px;
		margin: 0 auto;
		padding: var(--space-8) var(--space-6);
	}
	.kicker {
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-accent-700);
		margin-bottom: var(--space-2);
	}
	h1 {
		font-size: var(--ws-display);
		margin-bottom: var(--space-3);
	}
	.body {
		font-size: 15px;
		max-width: 60ch;
	}
	.code {
		font-size: 12px;
		color: color-mix(in srgb, var(--color-text) 55%, transparent);
		border-top: 2px solid var(--color-divider);
		padding-top: var(--space-3);
	}
	.actions {
		margin-top: var(--space-4);
	}
</style>
