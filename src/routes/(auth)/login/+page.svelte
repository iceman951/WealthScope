<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$components/base/Button.svelte';
	import ErrorMessage from '$components/feedback/ErrorMessage.svelte';
	import FormField from '$components/forms/FormField.svelte';
	import TextInput from '$components/forms/TextInput.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let pending = $state(false);
	const errors = $derived(form?.success === false ? form.errors : {});
	const values = $derived(form?.success === false ? form.values : {});
</script>

<svelte:head><title>Sign in · WealthScope</title></svelte:head>

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
	<h1>Sign in</h1>
	<p class="text-muted lede">Your records are waiting where you left them.</p>

	{#if errors._form}
		<div class="alert"><ErrorMessage message={errors._form.join(' ')} /></div>
	{/if}

	<input type="hidden" name="redirectTo" value={data.redirectTo} />

	<div class="fields">
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

		<FormField id="password" label="Password" errors={errors.password} required>
			{#snippet children({ id, describedBy, invalid })}
				<TextInput
					{id}
					name="password"
					type="password"
					autocomplete="current-password"
					required
					{invalid}
					{describedBy}
				/>
			{/snippet}
		</FormField>
	</div>

	<Button variant="primary" type="submit" block {pending} pendingLabel="Signing in…">
		Sign in
	</Button>

	<p class="switch text-muted">
		No account yet? <a href="/register">Create one</a>.
	</p>
	<p class="reset text-muted">
		Forgotten your password? Email delivery is not configured on this deployment, so a reset has to
		be done by the operator.
	</p>
</form>

<style>
	h1 {
		font-size: 32px;
		margin-bottom: var(--space-2);
	}
	.lede {
		font-size: 14px;
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
	.reset {
		font-size: 11.5px;
		border-top: 2px solid var(--color-divider);
		padding-top: var(--space-3);
		margin-top: var(--space-4);
	}
</style>
