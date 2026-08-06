<script lang="ts">
	import { enhance } from '$app/forms';
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
			return async ({ update }) => {
				await update();
				pending = false;
				onclose();
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
