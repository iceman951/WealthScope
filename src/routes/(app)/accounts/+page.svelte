<script lang="ts">
	import Button from '$components/base/Button.svelte';
	import StatusTag from '$components/base/StatusTag.svelte';
	import ConfirmationDialog from '$components/feedback/ConfirmationDialog.svelte';
	import EmptyState from '$components/feedback/EmptyState.svelte';
	import Checkbox from '$components/forms/Checkbox.svelte';
	import FormField from '$components/forms/FormField.svelte';
	import RecordDialog from '$components/forms/RecordDialog.svelte';
	import Select from '$components/forms/Select.svelte';
	import TextInput from '$components/forms/TextInput.svelte';
	import { showToast } from '$lib/stores/toast.svelte';
	import {
		ACCOUNT_TYPES,
		ACCOUNT_TYPE_LABELS,
		SUPPORTED_CURRENCIES,
		type AccountType
	} from '$lib/types/domain';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type Row = PageData['accounts'][number];

	let dialog = $state<'none' | 'create' | 'edit'>('none');
	let editing = $state<Row | null>(null);
	let deleting = $state<Row | null>(null);

	const errors = $derived(form?.success === false ? form.errors : {});
	const values = $derived(form?.success === false ? form.values : {});

	$effect(() => {
		if (form?.success === true) {
			showToast(form.message);
			dialog = 'none';
			editing = null;
		}
	});

	const typeOptions = ACCOUNT_TYPES.map((t) => ({ value: t, label: ACCOUNT_TYPE_LABELS[t] }));
	const currencyOptions = SUPPORTED_CURRENCIES.map((c) => ({
		value: c.code,
		label: `${c.code} — ${c.name}`
	}));

	function field(name: string, fallback: string): string {
		return values[name] ?? fallback;
	}
</script>

<div class="ws-filterbar">
	<span class="text-muted count">
		{data.accounts.length}
		{data.accounts.length === 1 ? 'account' : 'accounts'}
	</span>
	<div class="ws-row ws-row--end">
		<Button
			variant="primary"
			onclick={() => {
				editing = null;
				dialog = 'create';
			}}>Add account</Button
		>
	</div>
</div>

<div class="ws-grid ws-grid--flush ws-grid--side">
	<div class="ws-pad ws-scroll-x">
		{#if data.accounts.length === 0}
			<EmptyState
				title="No accounts yet"
				description="An account is the wrapper a record sits in — a bank, a broker, a retirement scheme. It determines how liquid the holdings inside it are, and transactions must belong to one."
				level={4}
			>
				{#snippet actions()}
					<Button
						variant="primary"
						onclick={() => {
							editing = null;
							dialog = 'create';
						}}>Add account</Button
					>
				{/snippet}
			</EmptyState>
		{:else}
			<table class="table">
				<caption class="visually-hidden">Financial accounts</caption>
				<thead>
					<tr>
						<th scope="col">Account</th>
						<th scope="col">Type</th>
						<th scope="col">Currency</th>
						<th scope="col" class="num">Assets</th>
						<th scope="col" class="num">Liabilities</th>
						<th scope="col" class="num">Transactions</th>
						<th scope="col"><span class="visually-hidden">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.accounts as account (account.id)}
						<tr>
							<td>
								<span class="name">{account.name}</span>
								<span class="text-muted meta">
									{account.institution ?? 'No institution recorded'}
									{#if !account.isActive}
										· closed{/if}
								</span>
							</td>
							<td>{ACCOUNT_TYPE_LABELS[account.accountType as AccountType]}</td>
							<td><StatusTag>{account.currency}</StatusTag></td>
							<td class="num">{account.assetCount}</td>
							<td class="num">{account.liabilityCount}</td>
							<td class="num">{account.transactionCount}</td>
							<td class="actions-cell">
								<button
									type="button"
									class="btn btn-ghost small"
									onclick={() => {
										editing = account;
										dialog = 'edit';
									}}>Edit</button
								>
								<button
									type="button"
									class="btn btn-ghost small"
									onclick={() => (deleting = account)}>Remove</button
								>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<div class="ws-pad side">
		<h5>Why accounts matter</h5>
		<p class="text-muted small">
			Liquidity is a property of where value sits, not of the instrument alone: the same fund is
			liquid in a brokerage account and illiquid inside a locked retirement wrapper. Assigning an
			account is what lets the liquidity ladder and the emergency-cover figure be right.
		</p>
		<div class="hr"></div>
		<h5>Deleting an account</h5>
		<p class="text-muted small">
			Assets and liabilities detach and become unassigned — the records survive. An account with
			transactions cannot be deleted at all, because removing it would take the trade history that
			cost basis and realised gains are computed from.
		</p>
	</div>
</div>

<RecordDialog
	open={dialog !== 'none'}
	title={dialog === 'edit' ? 'Edit account' : 'Add account'}
	action={dialog === 'edit' ? '?/update' : '?/create'}
	submitLabel={dialog === 'edit' ? 'Save changes' : 'Save account'}
	formError={errors._form?.join(' ')}
	onclose={() => {
		dialog = 'none';
		editing = null;
	}}
>
	{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}

	<FormField id="account-name" label="Name" errors={errors.name} required>
		{#snippet children({ id, describedBy, invalid })}
			<TextInput
				{id}
				name="name"
				required
				{invalid}
				{describedBy}
				value={field('name', editing?.name ?? '')}
				placeholder="e.g. Everyday current account"
			/>
		{/snippet}
	</FormField>

	<div class="pair">
		<FormField id="account-type" label="Type" errors={errors.accountType} required>
			{#snippet children({ id, describedBy, invalid })}
				<Select
					{id}
					name="accountType"
					options={typeOptions}
					required
					{invalid}
					{describedBy}
					value={field('accountType', editing?.accountType ?? 'bank')}
				/>
			{/snippet}
		</FormField>

		<FormField id="account-currency" label="Currency" errors={errors.currency} required>
			{#snippet children({ id, describedBy, invalid })}
				<Select
					{id}
					name="currency"
					options={currencyOptions}
					required
					{invalid}
					{describedBy}
					value={field('currency', editing?.currency ?? data.baseCurrency)}
				/>
			{/snippet}
		</FormField>
	</div>

	<FormField id="account-institution" label="Institution" errors={errors.institution}>
		{#snippet children({ id, describedBy, invalid })}
			<TextInput
				{id}
				name="institution"
				{invalid}
				{describedBy}
				value={field('institution', editing?.institution ?? '')}
				placeholder="Optional"
			/>
		{/snippet}
	</FormField>

	<FormField id="account-description" label="Description" errors={errors.description}>
		{#snippet children({ id, describedBy, invalid })}
			<TextInput
				{id}
				name="description"
				{invalid}
				{describedBy}
				value={field('description', editing?.description ?? '')}
				placeholder="Optional"
			/>
		{/snippet}
	</FormField>

	<Checkbox
		id="account-active"
		name="isActive"
		label="Account is open"
		checked={editing ? editing.isActive : true}
	/>
</RecordDialog>

<ConfirmationDialog
	open={deleting !== null}
	title="Remove this account?"
	message={deleting
		? `"${deleting.name}" will be deleted. ${deleting.assetCount + deleting.liabilityCount} linked records become unassigned; none of them are deleted.`
		: ''}
	confirmLabel="Remove account"
	action="?/delete"
	fields={deleting ? { id: deleting.id } : {}}
	onclose={() => (deleting = null)}
/>

<style>
	.count {
		font-size: 12px;
	}
	.name {
		display: block;
		font-weight: 600;
	}
	.meta {
		display: block;
		font-size: 11px;
	}
	.actions-cell {
		text-align: right;
		white-space: nowrap;
	}
	.btn.small {
		font-size: 11px;
	}
	.side h5 {
		margin: 0 0 var(--space-3);
	}
	.small {
		font-size: 12.5px;
	}
</style>
