<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Label + control + hint + error, wired together with ids so the control is
	 * always named and its error is always announced.
	 */
	interface Props {
		id: string;
		label: string;
		errors?: string[];
		hint?: string;
		required?: boolean;
		/** Receives the ids the control must reference. */
		children: Snippet<[{ id: string; describedBy: string | undefined; invalid: boolean }]>;
	}

	let { id, label, errors = [], hint, required = false, children }: Props = $props();

	const invalid = $derived(errors.length > 0);
	const hintId = $derived(hint ? `${id}-hint` : undefined);
	const errorId = $derived(invalid ? `${id}-error` : undefined);
	const describedBy = $derived([hintId, errorId].filter(Boolean).join(' ') || undefined);
</script>

<div class="field">
	<label for={id}>
		{label}{#if required}<span aria-hidden="true"> *</span><span class="visually-hidden">
				(required)</span
			>{/if}
	</label>
	{@render children({ id, describedBy, invalid })}
	{#if hint}<p class="field-hint" id={hintId}>{hint}</p>{/if}
	{#if invalid}
		<p class="field-error" id={errorId}>
			<span aria-hidden="true">!</span>
			<span>{errors.join(' ')}</span>
		</p>
	{/if}
</div>
