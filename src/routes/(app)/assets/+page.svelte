<script lang="ts">
	import Button from '$components/base/Button.svelte';
	import PercentageDisplay from '$components/base/PercentageDisplay.svelte';
	import StatusTag from '$components/base/StatusTag.svelte';
	import ConfirmationDialog from '$components/feedback/ConfirmationDialog.svelte';
	import EmptyState from '$components/feedback/EmptyState.svelte';
	import ErrorMessage from '$components/feedback/ErrorMessage.svelte';
	import CurrencyInput from '$components/forms/CurrencyInput.svelte';
	import DateInput from '$components/forms/DateInput.svelte';
	import FormField from '$components/forms/FormField.svelte';
	import NumberInput from '$components/forms/NumberInput.svelte';
	import RecordDialog from '$components/forms/RecordDialog.svelte';
	import Select from '$components/forms/Select.svelte';
	import TextInput from '$components/forms/TextInput.svelte';
	import { getFormatters } from '$lib/stores/formatting.svelte';
	import { showToast } from '$lib/stores/toast.svelte';
	import {
		ASSET_TYPES,
		ASSET_TYPE_LABELS,
		SUPPORTED_CURRENCIES,
		type AssetType
	} from '$lib/types/domain';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const fmt = getFormatters();

	type Row = PageData['rows'][number];

	let dialog = $state<'none' | 'create' | 'edit'>('none');
	let editing = $state<Row | null>(null);
	let deleting = $state<Row | null>(null);

	const errors = $derived(form?.success === false ? form.errors : {});
	const values = $derived(form?.success === false ? form.values : {});

	// A failed submission must not close the dialog and lose what was typed.
	$effect(() => {
		if (form?.success === true) {
			showToast(form.message);
			dialog = 'none';
			editing = null;
		}
	});

	const typeOptions = ASSET_TYPES.map((type) => ({
		value: type,
		label: ASSET_TYPE_LABELS[type]
	}));

	const currencyOptions = SUPPORTED_CURRENCIES.map((c) => ({
		value: c.code,
		label: `${c.code} — ${c.name}`
	}));

	const accountOptions = $derived([
		{ value: '', label: 'Not in an account' },
		...data.accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))
	]);

	function openCreate() {
		editing = null;
		dialog = 'create';
	}

	function openEdit(row: Row) {
		editing = row;
		dialog = 'edit';
	}

	function field(name: string, fallback: string): string {
		return values[name] ?? fallback;
	}

	const filterHref = (type: AssetType | null) => (type ? `/assets?type=${type}` : '/assets');
</script>

<div class="ws-filterbar">
	<a class="ws-chip" href="/assets" aria-current={data.filter === null ? 'true' : undefined}>All</a>
	{#each data.typesInUse as type (type)}
		<a
			class="ws-chip"
			href={filterHref(type)}
			aria-current={data.filter === type ? 'true' : undefined}
		>
			{ASSET_TYPE_LABELS[type]}
		</a>
	{/each}
	<div class="ws-row ws-row--end">
		<a class="btn btn-secondary" href="/import?kind=assets">Import</a>
		<Button variant="primary" onclick={openCreate}>Add asset</Button>
	</div>
</div>

{#if data.missingRates.length > 0}
	<div class="notice">
		<ErrorMessage
			tone="warning"
			message="No exchange rate for {data.missingRates.join(
				', '
			)}. Rows in those currencies are listed but excluded from the totals."
		/>
	</div>
{/if}

<div class="ws-grid ws-grid--flush ws-grid--side">
	<div class="ws-pad ws-scroll-x">
		{#if data.rows.length === 0}
			<EmptyState
				title={data.filter ? 'Nothing in this class' : 'No assets recorded'}
				description={data.filter
					? 'No records match this filter. Clear it to see everything, or add a record in this class.'
					: 'Add a property, an account balance, a deposit or a holding. Every dashboard figure is derived from these records.'}
				level={4}
			>
				{#snippet actions()}
					<Button variant="primary" onclick={openCreate}>Add asset</Button>
					{#if data.filter}<a class="btn btn-secondary" href="/assets">Clear filter</a>{/if}
				{/snippet}
			</EmptyState>
		{:else}
			<table class="table">
				<caption class="visually-hidden">Recorded assets</caption>
				<thead>
					<tr>
						<th scope="col">Record</th>
						<th scope="col">Class</th>
						<th scope="col">Liquidity</th>
						<th scope="col" class="num">Value</th>
						<th scope="col" class="num">Share</th>
						<th scope="col"><span class="visually-hidden">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.rows as row (row.id)}
						<tr>
							<td>
								<span class="name">{row.name}</span>
								<span class="text-muted meta">
									{row.symbol ? `${row.symbol} · ` : ''}{row.accountName ?? 'No account'} · valued
									{fmt.date(row.valuationDate)}
								</span>
							</td>
							<td>{ASSET_TYPE_LABELS[row.assetType as AssetType]}</td>
							<td><StatusTag>{row.liquidity}</StatusTag></td>
							<td class="num">
								{fmt.money(row.baseValue)}
								{#if row.currency !== data.baseCurrency}
									<span class="text-muted native"
										>{fmt.money(row.nativeValue, { currency: row.currency })}</span
									>
								{/if}
							</td>
							<td class="num"><PercentageDisplay value={row.share} /></td>
							<td class="actions-cell">
								<button type="button" class="btn btn-ghost small" onclick={() => openEdit(row)}>
									Edit
								</button>
								<button type="button" class="btn btn-ghost small" onclick={() => (deleting = row)}>
									Remove
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr>
						<td colspan="3" class="total-label">
							Total · {data.filter ? ASSET_TYPE_LABELS[data.filter] : 'All classes'}
						</td>
						<td class="num total-value">{fmt.money(data.shownTotal)}</td>
						<td colspan="2"></td>
					</tr>
				</tfoot>
			</table>
		{/if}
	</div>

	<div class="ws-pad side">
		<h5>How value is computed</h5>
		<p class="text-muted small">
			A record is worth <strong>quantity × unit price</strong>, unless you record a value directly —
			which is what a house or a business stake needs. Values are stored as exact decimals and
			converted into {data.baseCurrency} using the rates on file.
		</p>
		<div class="hr"></div>
		<h5>Liquidity</h5>
		<p class="text-muted small">
			Liquidity is derived from the asset class and the account it sits in, so the same fund is
			liquid in a brokerage account and illiquid inside a locked retirement wrapper.
		</p>
		<div class="ws-row tags">
			<StatusTag tone="outline">Liquid</StatusTag>
			<StatusTag tone="outline">Semi-liquid</StatusTag>
			<StatusTag tone="outline">Illiquid</StatusTag>
		</div>
		<div class="hr"></div>
		<h5>Classes</h5>
		<div class="ws-row tags">
			{#each ASSET_TYPES as type (type)}
				<StatusTag tone="outline">{ASSET_TYPE_LABELS[type]}</StatusTag>
			{/each}
		</div>
	</div>
</div>

<RecordDialog
	open={dialog !== 'none'}
	title={dialog === 'edit' ? 'Edit asset' : 'Add asset'}
	action={dialog === 'edit' ? '?/update' : '?/create'}
	submitLabel={dialog === 'edit' ? 'Save changes' : 'Save asset'}
	formError={errors._form?.join(' ')}
	description="Validated on the server before anything is written. Every metric recomputes from this record."
	onclose={() => {
		dialog = 'none';
		editing = null;
	}}
>
	{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}

	<FormField id="asset-name" label="Name" errors={errors.name} required>
		{#snippet children({ id, describedBy, invalid })}
			<TextInput
				{id}
				name="name"
				required
				{invalid}
				{describedBy}
				value={field('name', editing?.name ?? '')}
				placeholder="e.g. Fixed deposit — 12 month"
			/>
		{/snippet}
	</FormField>

	<div class="pair">
		<FormField id="asset-type" label="Class" errors={errors.assetType} required>
			{#snippet children({ id, describedBy, invalid })}
				<Select
					{id}
					name="assetType"
					options={typeOptions}
					required
					{invalid}
					{describedBy}
					value={field('assetType', editing?.assetType ?? 'cash')}
				/>
			{/snippet}
		</FormField>

		<FormField id="asset-currency" label="Currency" errors={errors.currency} required>
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

	<FormField
		id="asset-account"
		label="Account"
		errors={errors.accountId}
		hint="Optional. Determines liquidity for wrapped holdings."
	>
		{#snippet children({ id, describedBy, invalid })}
			<Select
				{id}
				name="accountId"
				options={accountOptions}
				{invalid}
				{describedBy}
				value={field('accountId', editing?.accountId ?? '')}
			/>
		{/snippet}
	</FormField>

	<div class="pair">
		<FormField
			id="asset-quantity"
			label="Quantity"
			errors={errors.quantity}
			hint="Leave at 1 for a single item."
		>
			{#snippet children({ id, describedBy, invalid })}
				<NumberInput
					{id}
					name="quantity"
					{invalid}
					{describedBy}
					align="right"
					value={field('quantity', editing?.quantity ?? '1')}
				/>
			{/snippet}
		</FormField>

		<FormField id="asset-unit-price" label="Unit price" errors={errors.unitPrice}>
			{#snippet children({ id, describedBy, invalid })}
				<CurrencyInput
					{id}
					name="unitPrice"
					currency={field('currency', editing?.currency ?? data.baseCurrency)}
					{invalid}
					{describedBy}
					value={field('unitPrice', editing?.unitPrice ?? '0')}
				/>
			{/snippet}
		</FormField>
	</div>

	<div class="pair">
		<FormField
			id="asset-manual-value"
			label="Value"
			errors={errors.manualValue}
			hint="Overrides quantity × price."
		>
			{#snippet children({ id, describedBy, invalid })}
				<CurrencyInput
					{id}
					name="manualValue"
					currency={field('currency', editing?.currency ?? data.baseCurrency)}
					{invalid}
					{describedBy}
					value={field('manualValue', editing?.manualValue ?? '')}
					placeholder=""
				/>
			{/snippet}
		</FormField>

		<FormField
			id="asset-cost"
			label="Acquisition cost"
			errors={errors.acquisitionCost}
			hint="Needed for gain and return figures."
		>
			{#snippet children({ id, describedBy, invalid })}
				<CurrencyInput
					{id}
					name="acquisitionCost"
					currency={field('currency', editing?.currency ?? data.baseCurrency)}
					{invalid}
					{describedBy}
					value={field('acquisitionCost', editing?.acquisitionCost ?? '')}
					placeholder=""
				/>
			{/snippet}
		</FormField>
	</div>

	<div class="pair">
		<FormField id="asset-symbol" label="Ticker" errors={errors.symbol}>
			{#snippet children({ id, describedBy, invalid })}
				<TextInput
					{id}
					name="symbol"
					{invalid}
					{describedBy}
					value={field('symbol', editing?.symbol ?? '')}
					placeholder="Optional"
				/>
			{/snippet}
		</FormField>

		<FormField
			id="asset-valuation-date"
			label="Valuation date"
			errors={errors.valuationDate}
			required
		>
			{#snippet children({ id, describedBy, invalid })}
				<DateInput
					{id}
					name="valuationDate"
					required
					{invalid}
					{describedBy}
					value={field('valuationDate', editing?.valuationDate ?? data.today)}
				/>
			{/snippet}
		</FormField>
	</div>
</RecordDialog>

<ConfirmationDialog
	open={deleting !== null}
	title="Remove this asset?"
	message={deleting
		? `"${deleting.name}" will be deleted permanently. Net worth, allocation, liquidity and every score recompute without it.`
		: ''}
	confirmLabel="Remove asset"
	action="?/delete"
	fields={deleting ? { id: deleting.id } : {}}
	onclose={() => (deleting = null)}
/>

<style>
	.notice {
		padding: var(--space-4) var(--space-6) 0;
	}
	.name {
		display: block;
		font-weight: 600;
	}
	.meta {
		display: block;
		font-size: 11px;
		font-weight: 400;
	}
	.native {
		display: block;
		font-size: 11px;
	}
	.actions-cell {
		text-align: right;
		white-space: nowrap;
	}
	.small {
		font-size: 11px;
	}
	.total-label {
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.total-value {
		font-family: var(--font-heading);
		font-weight: 800;
	}
	.side h5 {
		margin: 0 0 var(--space-3);
	}
	.side .small {
		font-size: 12.5px;
	}
	.tags {
		gap: 6px;
	}
</style>
