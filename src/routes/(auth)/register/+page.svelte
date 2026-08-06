<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$components/base/Button.svelte';
	import ErrorMessage from '$components/feedback/ErrorMessage.svelte';
	import FormField from '$components/forms/FormField.svelte';
	import TextInput from '$components/forms/TextInput.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let pending = $state(false);
	const errors = $derived(form?.success === false ? form.errors : {});
	const values = $derived(form?.success === false ? form.values : {});
</script>

<svelte:head><title>Create an account · WealthScope</title></svelte:head>

<form
	method="POST"
	use:enhance={() => {
		pending = true;
		return async ({ update }) => {
			await update();
			pending = false;
		};
	}}
	novalidate
>
	<h1>Create an account</h1>
	<p class="text-muted lede">
		Four fields, then three short setup steps. Everything else is inferred from the records you
		enter.
	</p>

	{#if errors._form}
		<div class="alert"><ErrorMessage message={errors._form.join(' ')} /></div>
	{/if}

	<div class="fields">
		<FormField id="name" label="Name" errors={errors.name} required>
			{#snippet children({ id, describedBy, invalid })}
				<TextInput
					{id}
					name="name"
					autocomplete="name"
					required
					{invalid}
					{describedBy}
					value={values.name ?? ''}
				/>
			{/snippet}
		</FormField>

		<FormField id="email" label="Email" errors={errors.email} required>
			{#snippet children({ id, describedBy, invalid })}
				<TextInput
					{id}
					name="email"
					type="email"
					autocomplete="email"
					required
					{invalid}
					{describedBy}
					value={values.email ?? ''}
				/>
			{/snippet}
		</FormField>

		<FormField
			id="password"
			label="Password"
			errors={errors.password}
			hint="At least 12 characters. Length matters more than symbols."
			required
		>
			{#snippet children({ id, describedBy, invalid })}
				<TextInput
					{id}
					name="password"
					type="password"
					autocomplete="new-password"
					required
					{invalid}
					{describedBy}
				/>
			{/snippet}
		</FormField>

		<FormField
			id="confirmPassword"
			label="Confirm password"
			errors={errors.confirmPassword}
			required
		>
			{#snippet children({ id, describedBy, invalid })}
				<TextInput
					{id}
					name="confirmPassword"
					type="password"
					autocomplete="new-password"
					required
					{invalid}
					{describedBy}
				/>
			{/snippet}
		</FormField>
	</div>

	<Button variant="primary" type="submit" block {pending} pendingLabel="Creating…">
		Create account
	</Button>

	<p class="switch text-muted">Already have an account? <a href="/login">Sign in</a>.</p>
	<p class="legal text-muted">
		Your records are stored on the server so they are available on every device you sign in from.
		See <a href="/privacy">Privacy</a> for exactly what is kept.
	</p>
</form>

<style>
	h1 {
		font-size: 32px;
		margin-bottom: var(--space-2);
	}
	.lede {
		font-size: 14px;
		max-width: 48ch;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		margin: var(--space-6) 0;
	}
	.alert {
		margin-top: var(--space-4);
	}
	.switch {
		font-size: 13px;
		margin-top: var(--space-4);
	}
	.legal {
		font-size: 11.5px;
		border-top: 2px solid var(--color-divider);
		padding-top: var(--space-3);
		margin-top: var(--space-4);
	}
</style>
