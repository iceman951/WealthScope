<script lang="ts">
	import Button from '$components/base/Button.svelte';
	import PercentageDisplay from '$components/base/PercentageDisplay.svelte';
	import ConfirmationDialog from '$components/feedback/ConfirmationDialog.svelte';
	import EmptyState from '$components/feedback/EmptyState.svelte';
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
		LIABILITY_TYPES,
		LIABILITY_TYPE_LABELS,
		SUPPORTED_CURRENCIES,
		type LiabilityType
	} from '$lib/types/domain';
	import { barWidth } from '$engine/money';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const fmt = getFormatters();
	type Row = PageData['rows'][number];

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

	const typeOptions = LIABILITY_TYPES.map((t) => ({ value: t, label: LIABILITY_TYPE_LABELS[t] }));
	const currencyOptions = SUPPORTED_CURRENCIES.map((c) => ({
		value: c.code,
		label: `${c.code} — ${c.name}`
	}));
	const accountOptions = $derived([
		{ value: '', label: 'Not linked to an account' },
		...data.accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))
	]);

	function field(name: string, fallback: string): string {
		return values[name] ?? fallback;
	}

	function payoffLabel(months: number | null): string {
		if (months === null) return 'Not on this payment';
		if (months === 0) return 'Cleared';
		const years = Math.floor(months / 12);
		const rest = months % 12;
		return years === 0 ? `${rest} mo` : rest === 0 ? `${years} yr` : `${years} yr ${rest} mo`;
	}
</script>

<div class="ws-filterbar">
	<span class="text-muted count"
		>{data.rows.length} {data.rows.length === 1 ? 'liability' : 'liabilities'}</span
	>
	<div class="ws-row ws-row--end">
		<a class="btn btn-secondary" href="/import?kind=liabilities">Import</a>
		<Button
			variant="primary"
			onclick={() => {
				editing = null;
				dialog = 'create';
			}}
		>
			Add liability
		</Button>
	</div>
</div>

<div class="ws-grid ws-grid--flush ws-grid--side">
	<div class="ws-pad ws-scroll-x">
		{#if data.rows.length === 0}
			<EmptyState
				title="No liabilities recorded"
				description="Mortgages, loans, cards and lines of credit. Recording them turns net worth from a total of assets into a real balance sheet, and unlocks the debt metrics."
				level={4}
			>
				{#snippet actions()}
					<Button
						variant="primary"
						onclick={() => {
							editing = null;
							dialog = 'create';
						}}>Add liability</Button
					>
				{/snippet}
			</EmptyState>
		{:else}
			<table class="table">
				<caption class="visually-hidden">Recorded liabilities</caption>
				<thead>
					<tr>
						<th scope="col">Liability</th>
						<th scope="col">Type</th>
						<th scope="col" class="num">Balance</th>
						<th scope="col" class="num">Rate</th>
						<th scope="col" class="num">Monthly</th>
						<th scope="col" class="num">Term left</th>
						<th scope="col"><span class="visually-hidden">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.rows as row (row.id)}
						<tr>
							<td>
								<span class="name">{row.name}</span>
								<span class="text-muted meta">{row.group}</span>
							</td>
							<td>{row.typeLabel}</td>
							<td class="num">{fmt.money(row.balance)}</td>
							<td class="num">{fmt.percent(row.annualRate, 2)}</td>
							<td class="num">{fmt.money(row.monthlyPayment)}</td>
							<td class="num">
								{row.term}
								{#if row.neverAmortises && row.monthlyPayment.greaterThan(0)}
									<span class="text-muted warn">Payment below monthly interest</span>
								{/if}
							</td>
							<td class="actions-cell">
								<button
									type="button"
									class="btn btn-ghost small"
									onclick={() => {
										editing = row;
										dialog = 'edit';
									}}>Edit</button
								>
								<button type="button" class="btn btn-ghost small" onclick={() => (deleting = row)}>
									Remove
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr>
						<td colspan="2" class="total-label">Total debt</td>
						<td class="num total-value">{fmt.money(data.debt.totalDebt)}</td>
						<td class="num total-value">
							<PercentageDisplay value={data.debt.weightedAverageRate} decimals={2} />
						</td>
						<td class="num total-value">{fmt.money(data.debt.monthlyDebtPayment)}</td>
						<td colspan="2"></td>
					</tr>
				</tfoot>
			</table>

			<div class="ws-rule-top">
				<h5>Payoff order — highest rate first</h5>
				<div class="ws-stack--tight">
					{#each data.payoff as step (step.id)}
						<div class="payoff">
							<span class="rank">{step.rank}</span>
							<div>
								<div class="payoff-head">
									<span>{step.name}</span>
									<span class="text-muted">
										{fmt.percent(step.annualRate, 2)} · {fmt.money(step.annualInterest)} interest / yr
										· clears in {payoffLabel(step.clearedInMonth)}
									</span>
								</div>
								<div class="ws-track ws-track--sm">
									<span
										class="ws-fill"
										style="background:{step.expensive
											? 'var(--color-accent)'
											: 'var(--color-text)'};width:{barWidth(step.barPercent)}%"
									></span>
								</div>
							</div>
							<span class="num balance">{fmt.money(step.balance)}</span>
						</div>
					{/each}
				</div>
				<p class="text-muted small note">
					Avalanche order: minimum payments everywhere, every spare unit against the highest rate.
					Clearing times assume the current payment continues and the rate does not change.
				</p>
			</div>
		{/if}
	</div>

	<div class="ws-pad side">
		<div class="ws-kicker">Debt service ratio</div>
		<div class="ws-value ws-value--md">
			<PercentageDisplay value={data.debt.debtServiceRatio} />
		</div>
		<p class="text-muted small">
			Of gross monthly income {fmt.money(data.monthlyIncome)}. Under 36% is the threshold used by
			the health score.
		</p>

		<div class="hr"></div>

		<div class="ws-kicker">Interest over the next year</div>
		<div class="ws-value ws-value--md">{fmt.money(data.debt.annualInterest)}</div>
		<p class="text-muted small">
			Straight-line estimate from current balances and rates. Amortisation schedules are computed on
			the server from those same figures — no rate feed is required.
		</p>

		<div class="hr"></div>

		<div class="ws-kv">
			<span>Debt-to-assets</span><span><PercentageDisplay value={data.debt.debtToAssets} /></span>
		</div>
		<div class="ws-kv">
			<span>Weighted average rate</span><span
				><PercentageDisplay value={data.debt.weightedAverageRate} decimals={2} /></span
			>
		</div>
		<div class="ws-kv">
			<span>Monthly commitment</span><span>{fmt.money(data.debt.monthlyDebtPayment)}</span>
		</div>
	</div>
</div>

<RecordDialog
	open={dialog !== 'none'}
	title={dialog === 'edit' ? 'Edit liability' : 'Add liability'}
	action={dialog === 'edit' ? '?/update' : '?/create'}
	submitLabel={dialog === 'edit' ? 'Save changes' : 'Save liability'}
	formError={errors._form?.join(' ')}
	onclose={() => {
		dialog = 'none';
		editing = null;
	}}
>
	{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}

	<FormField id="liability-name" label="Name" errors={errors.name} required>
		{#snippet children({ id, describedBy, invalid })}
			<TextInput
				{id}
				name="name"
				required
				{invalid}
				{describedBy}
				value={field('name', editing?.name ?? '')}
				placeholder="e.g. Mortgage — primary residence"
			/>
		{/snippet}
	</FormField>

	<div class="pair">
		<FormField id="liability-type" label="Type" errors={errors.liabilityType} required>
			{#snippet children({ id, describedBy, invalid })}
				<Select
					{id}
					name="liabilityType"
					options={typeOptions}
					required
					{invalid}
					{describedBy}
					value={field(
						'liabilityType',
						(editing?.form.liabilityType as LiabilityType) ?? 'mortgage'
					)}
				/>
			{/snippet}
		</FormField>

		<FormField id="liability-currency" label="Currency" errors={errors.currency} required>
			{#snippet children({ id, describedBy, invalid })}
				<Select
					{id}
					name="currency"
					options={currencyOptions}
					required
					{invalid}
					{describedBy}
					value={field('currency', editing?.form.currency ?? data.baseCurrency)}
				/>
			{/snippet}
		</FormField>
	</div>

	<FormField id="liability-account" label="Account" errors={errors.accountId}>
		{#snippet children({ id, describedBy, invalid })}
			<Select
				{id}
				name="accountId"
				options={accountOptions}
				{invalid}
				{describedBy}
				value={field('accountId', editing?.form.accountId ?? '')}
			/>
		{/snippet}
	</FormField>

	<div class="pair">
		<FormField
			id="liability-principal"
			label="Original principal"
			errors={errors.originalPrincipal}
			required
		>
			{#snippet children({ id, describedBy, invalid })}
				<CurrencyInput
					{id}
					name="originalPrincipal"
					currency={field('currency', editing?.form.currency ?? data.baseCurrency)}
					required
					{invalid}
					{describedBy}
					value={field('originalPrincipal', editing?.form.originalPrincipal ?? '')}
				/>
			{/snippet}
		</FormField>

		<FormField
			id="liability-balance"
			label="Outstanding balance"
			errors={errors.outstandingBalance}
			required
		>
			{#snippet children({ id, describedBy, invalid })}
				<CurrencyInput
					{id}
					name="outstandingBalance"
					currency={field('currency', editing?.form.currency ?? data.baseCurrency)}
					required
					{invalid}
					{describedBy}
					value={field('outstandingBalance', editing?.form.outstandingBalance ?? '')}
				/>
			{/snippet}
		</FormField>
	</div>

	<div class="pair">
		<FormField
			id="liability-rate"
			label="Interest rate"
			errors={errors.interestRate}
			hint="Annual, as a percentage. 3.4 means 3.4% p.a."
			required
		>
			{#snippet children({ id, describedBy, invalid })}
				<NumberInput
					{id}
					name="interestRate"
					required
					{invalid}
					{describedBy}
					align="right"
					value={field('interestRate', editing?.form.interestRate ?? '')}
				/>
			{/snippet}
		</FormField>

		<FormField id="liability-monthly" label="Monthly payment" errors={errors.monthlyPayment}>
			{#snippet children({ id, describedBy, invalid })}
				<CurrencyInput
					{id}
					name="monthlyPayment"
					currency={field('currency', editing?.form.currency ?? data.baseCurrency)}
					{invalid}
					{describedBy}
					value={field('monthlyPayment', editing?.form.monthlyPayment ?? '')}
					placeholder=""
				/>
			{/snippet}
		</FormField>
	</div>

	<div class="pair">
		<FormField id="liability-start" label="Start date" errors={errors.startDate}>
			{#snippet children({ id, describedBy, invalid })}
				<DateInput
					{id}
					name="startDate"
					{invalid}
					{describedBy}
					value={field('startDate', editing?.form.startDate ?? '')}
				/>
			{/snippet}
		</FormField>

		<FormField id="liability-maturity" label="Maturity date" errors={errors.maturityDate}>
			{#snippet children({ id, describedBy, invalid })}
				<DateInput
					{id}
					name="maturityDate"
					{invalid}
					{describedBy}
					value={field('maturityDate', editing?.form.maturityDate ?? '')}
				/>
			{/snippet}
		</FormField>
	</div>
</RecordDialog>

<ConfirmationDialog
	open={deleting !== null}
	title="Remove this liability?"
	message={deleting
		? `"${deleting.name}" will be deleted permanently. Net worth, debt service and the payoff order recompute without it.`
		: ''}
	confirmLabel="Remove liability"
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
	.meta,
	.warn {
		display: block;
		font-size: 11px;
		font-weight: 400;
	}
	.warn {
		color: var(--color-accent-700);
	}
	.actions-cell {
		text-align: right;
		white-space: nowrap;
	}
	.small {
		font-size: 12.5px;
	}
	.btn.small {
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
	h5 {
		margin: 0 0 var(--space-3);
	}
	.payoff {
		display: grid;
		grid-template-columns: 20px minmax(0, 1fr) minmax(0, auto);
		align-items: center;
		gap: var(--space-3);
		font-size: 13px;
	}
	.rank {
		font-family: var(--font-heading);
		font-weight: 800;
	}
	.payoff-head {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.balance {
		white-space: nowrap;
	}
	.note {
		margin-top: var(--space-3);
		font-size: 11.5px;
	}
	.side .ws-kv {
		margin-bottom: var(--space-2);
	}
</style>
