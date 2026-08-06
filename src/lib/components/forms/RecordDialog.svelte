<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import Button from '../base/Button.svelte';
	import Dialog from '../feedback/Dialog.svelte';
	import ErrorMessage from '../feedback/ErrorMessage.svelte';

	/**
	 * A create/edit form inside a modal, posting to a SvelteKit form action.
	 *
	 * The form is a real `<form method="POST">`, so it still submits when
	 * JavaScript is unavailable; `use:enhance` only upgrades the experience.
	 */
	interface Props {
		open: boolean;
		title: string;
		action: string;
		submitLabel?: string;
		width?: string;
		/** Form-level messages from the last submission. */
		formError?: string;
		description?: string;
		onclose: () => void;
		onsuccess?: () => void;
		children: Snippet;
	}

	let {
		open,
		title,
		action,
		submitLabel = 'Save',
		width = 'min(520px, 100%)',
		formError,
		description,
		onclose,
		onsuccess,
		children
	}: Props = $props();

	let pending = $state(false);
</script>

<Dialog {open} {title} {width} dismissible={!pending} {onclose}>
	{#if description}<p class="dialog-body">{description}</p>{/if}
	{#if formError}<ErrorMessage message={formError} />{/if}

	<form
		method="POST"
		{action}
		use:enhance={() => {
			pending = true;
			return async ({ result, update }) => {
				await update({ reset: false });
				pending = false;
				if (result.type === 'success') onsuccess?.();
			};
		}}
		novalidate
	>
		<div class="fields">
			{@render children()}
		</div>

		<div class="dialog-actions">
			<Button variant="secondary" onclick={onclose} disabled={pending}>Cancel</Button>
			<Button variant="primary" type="submit" {pending} pendingLabel="Saving…">
				{submitLabel}
			</Button>
		</div>
	</form>
</Dialog>

<style>
	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.fields :global(.pair) {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}
	@media (max-width: 560px) {
		.fields :global(.pair) {
			grid-template-columns: 1fr;
		}
	}
</style>
