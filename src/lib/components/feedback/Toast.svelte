<script lang="ts">
	import { dismissToast, toastState } from '$lib/stores/toast.svelte';

	const toasts = toastState();
</script>

{#if toasts.current}
	<div
		class="ws-toast"
		role="status"
		aria-live="polite"
		class:error={toasts.current.tone === 'error'}
	>
		<span class="ws-dot" aria-hidden="true"></span>
		<span>{toasts.current.text}</span>
		<button type="button" class="close" onclick={dismissToast} aria-label="Dismiss">×</button>
	</div>
{/if}

<style>
	.error .ws-dot {
		background: var(--color-accent-300);
	}
	.close {
		margin-left: var(--space-3);
		background: transparent;
		border: 0;
		color: inherit;
		font-size: 18px;
		line-height: 1;
		cursor: pointer;
		padding: 0 2px;
	}
	.close:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
</style>
