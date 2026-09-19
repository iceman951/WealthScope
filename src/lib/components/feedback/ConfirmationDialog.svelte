<script lang="ts">
	import { enhance } from '$app/forms';
	import { showToast } from '$lib/stores/toast.svelte';
	import Button from '../base/Button.svelte';
	import Dialog from './Dialog.svelte';

	/**
	 * Destructive confirmation. Submits a real form action rather than calling a
	 * client function, so deletion works with JavaScript unavailable too.
	 */
	interface Props {
		open: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		/** The action to post to, e.g. "?/delete". */
		action: string;
		/** Hidden fields the action needs, typically the record id. */
		fields: Record<string, string>;
		onclose: () => void;
	}

	let { open, title, message, confirmLabel = 'Delete', action, fields, onclose }: Props = $props();

	let pending = $state(false);
</script>

<Dialog {open} {title} {onclose} dismissible={!pending}>
	<p class="dialog-body">{message}</p>
	<form
		method="POST"
		{action}
		use:enhance={() => {
			pending = true;
			return async ({ result, update }) => {
				await update();
				pending = false;
				onclose();
				// The dialog is gone by the time the page could render a form
				// error, so a refusal (a holding that still has transactions, a
				// row that no longer exists) is voiced here instead.
				if (result.type === 'failure') {
					const message = (result.data as { message?: string } | undefined)?.message;
					showToast(message ?? 'That could not be deleted.', 'error');
				}
			};
		}}
	>
		{#each Object.entries(fields) as [name, value] (name)}
			<input type="hidden" {name} {value} />
		{/each}
		<div class="dialog-actions">
			<Button variant="secondary" onclick={onclose} disabled={pending}>Cancel</Button>
			<Button variant="danger" type="submit" {pending} pendingLabel="Deleting…">
				{confirmLabel}
			</Button>
		</div>
	</form>
</Dialog>
