<script lang="ts">
	import Button from '$components/base/Button.svelte';
	import MetricCard from '$components/base/MetricCard.svelte';
	import ChartFrame from '$components/charts/ChartFrame.svelte';
	import FlowBars from '$components/charts/FlowBars.svelte';
	import ConfirmationDialog from '$components/feedback/ConfirmationDialog.svelte';
	import EmptyState from '$components/feedback/EmptyState.svelte';
	import CurrencyInput from '$components/forms/CurrencyInput.svelte';
	import DateInput from '$components/forms/DateInput.svelte';
	import FormField from '$components/forms/FormField.svelte';
	import RecordDialog from '$components/forms/RecordDialog.svelte';
	import Select from '$components/forms/Select.svelte';
	import TextInput from '$components/forms/TextInput.svelte';
	import { getFormatters } from '$lib/stores/formatting.svelte';
	import { showToast } from '$lib/stores/toast.svelte';
	import {
		CASHFLOW_CATEGORY_LABELS,
		EXPENSE_CATEGORIES,
		FREQUENCIES,
		FREQUENCY_PER_YEAR,
		FREQUENCY_LABELS,
		INCOME_CATEGORIES,
		SUPPORTED_CURRENCIES,
		type CashflowCategory
	} from '$lib/types/domain';
	import { barWidth, dec } from '$engine/money';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const fmt = getFormatters();
	type Entry = PageData['entries'][number];

	let dialog = $state<'none' | 'create' | 'edit'>('none');
	let editing = $state<Entry | null>(null);
	let deleting = $state<Entry | null>(null);
	let entryType = $state<'income' | 'expense'>('income');

	const errors = $derived(form?.success === false ? form.errors : {});
	const values = $derived(form?.success === false ? form.values : {});

	$effect(() => {
		if (form?.success === true) {
			showToast(form.message);
			dialog = 'none';
			editing = null;
		}
	});

	const maxFlow = $derived(
		Math.max(
			1,
			...data.flow.map((p) => Math.max(dec(p.income).toNumber(), dec(p.expenses).toNumber()))
		) * 1.2
	);

	const flowBars = $derived(
		data.flow.map((point) => ({
			month: point.month,
			label: point.label,
			incomePercent: (dec(point.income).toNumber() / maxFlow) * 55,
			expensePercent: (dec(point.expenses).toNumber() / maxFlow) * 55,
			title: `${point.month}: income ${fmt.money(point.income)}, expenses ${fmt.money(point.expenses)}`
		}))
	);

	const categoryOptions = $derived(
		(entryType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => ({
			value: c,
			label: CASHFLOW_CATEGORY_LABELS[c]
		}))
	);
	const frequencyOptions = FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABELS[f] }));
	const currencyOptions = SUPPORTED_CURRENCIES.map((c) => ({
		value: c.code,
		label: `${c.code} — ${c.name}`
	}));

	const maxIncome = $derived(
		data.income.reduce((max, c) => Math.max(max, c.monthly.toNumber()), 1)
	);
	const maxExpense = $derived(
		data.expenses.reduce((max, c) => Math.max(max, c.monthly.toNumber()), 1)
	);

	function openCreate(type: 'income' | 'expense') {
		editing = null;
		entryType = type;
		dialog = 'create';
	}

	function openEdit(entry: Entry) {
		editing = entry;
		entryType = entry.entryType as 'income' | 'expense';
		dialog = 'edit';
	}

	function field(name: string, fallback: string): string {
		return values[name] ?? fallback;
	}

	const isEmpty = $derived(data.entries.length === 0);
</script>

<div class="ws-grid ws-grid--3">
	<MetricCard
		label="Monthly income"
		value={fmt.money(data.summary.monthlyIncome)}
		note="{fmt.money(data.summary.recurringIncome)} recurring"
		size="sm"
		padding="tight"
	/>
	<MetricCard
		label="Monthly expenses"
		value={fmt.money(data.summary.monthlyExpenses)}
		note="{fmt.money(data.summary.recurringExpenses)} recurring"
		size="sm"
		padding="tight"
	/>
	<MetricCard
		label="Savings rate"
		value={data.summary.savingsRate ? fmt.percent(data.summary.savingsRate) : '—'}
		note="{fmt.money(data.summary.netCashflow, { signed: true })} a month"
		size="sm"
		padding="tight"
	/>
</div>

{#if isEmpty}
	<EmptyState
		title="No income or expenses recorded"
		description="Recurring entries give the savings rate, the debt-service ratio and the emergency-cover figure something to measure against. A salary and a handful of categories is enough to start."
	>
		{#snippet actions()}
			<Button variant="primary" onclick={() => openCreate('income')}>Add income</Button>
			<Button variant="secondary" onclick={() => openCreate('expense')}>Add expense</Button>
			<a class="btn btn-secondary" href="/import?kind=cashflow">Import CSV</a>
		{/snippet}
	</EmptyState>
{:else}
	<div class="ws-pad chart-block">
		<ChartFrame
			title="Twelve-month cash flow"
			meta="Income above the axis, expenses below"
			summary="Monthly income and expenses over the last twelve months, averaging {fmt.money(
				data.summary.monthlyIncome
			)} in and {fmt.money(data.summary.monthlyExpenses)} out."
		>
			<FlowBars bars={flowBars} />

			{#snippet alternative()}
				<table class="table">
					<caption class="visually-hidden">Monthly income and expenses</caption>
					<thead>
						<tr>
							<th scope="col">Month</th>
							<th scope="col" class="num">Income</th>
							<th scope="col" class="num">Expenses</th>
							<th scope="col" class="num">Net</th>
						</tr>
					</thead>
					<tbody>
						{#each data.flow as point (point.month)}
							<tr>
								<td>{point.month}</td>
								<td class="num">{fmt.money(point.income)}</td>
								<td class="num">{fmt.money(point.expenses)}</td>
								<td class="num"
									>{fmt.money(point.income.minus(point.expenses), { signed: true })}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			{/snippet}
		</ChartFrame>
	</div>

	<div class="ws-grid ws-grid--flush ws-grid--2">
		<div class="ws-pad ws-scroll-x">
			<div class="ws-section-head">
				<h5>Income streams</h5>
				<Button variant="ghost" onclick={() => openCreate('income')}>Add income</Button>
			</div>
			{#if data.income.length === 0}
				<p class="text-muted small">No income recorded yet.</p>
			{:else}
				<table class="table">
					<caption class="visually-hidden">Income by category</caption>
					<tbody>
						{#each data.income as category (category.category)}
							<tr>
								<td>
									<span class="name">{category.label}</span>
									<span class="text-muted meta">
										{category.entries.map((e) => e.name).join(', ')}
									</span>
								</td>
								<td class="num strong">{fmt.money(category.monthly)}</td>
								<td class="bar-cell">
									<span
										class="bar income"
										style="width:{barWidth(category.monthly.dividedBy(maxIncome).times(100))}%"
									></span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>

		<div class="ws-pad ws-scroll-x">
			<div class="ws-section-head">
				<h5>Expense categories</h5>
				<Button variant="ghost" onclick={() => openCreate('expense')}>Add expense</Button>
			</div>
			{#if data.expenses.length === 0}
				<p class="text-muted small">No expenses recorded yet.</p>
			{:else}
				<table class="table">
					<caption class="visually-hidden">Expenses by category</caption>
					<tbody>
						{#each data.expenses as category (category.category)}
							<tr>
								<td>
									<span class="name">{category.label}</span>
									<span class="text-muted meta">
										{category.entries.map((e) => e.name).join(', ')}
									</span>
								</td>
								<td class="num strong">{fmt.money(category.monthly)}</td>
								<td class="bar-cell">
									<span
										class="bar expense"
										style="width:{barWidth(category.monthly.dividedBy(maxExpense).times(100))}%"
									></span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</div>

	<div class="ws-pad ws-scroll-x entries">
		<h5>All entries</h5>
		<table class="table">
			<caption class="visually-hidden">Every recorded income and expense entry</caption>
			<thead>
				<tr>
					<th scope="col">Entry</th>
					<th scope="col">Direction</th>
					<th scope="col">Category</th>
					<th scope="col">Frequency</th>
					<th scope="col" class="num">Amount</th>
					<th scope="col" class="num">Monthly equivalent</th>
					<th scope="col"><span class="visually-hidden">Actions</span></th>
				</tr>
			</thead>
			<tbody>
				{#each data.entries as entry (entry.id)}
					<tr>
						<td>
							<span class="name">{entry.name}</span>
							<span class="text-muted meta">
								From {fmt.date(entry.entryDate)}{entry.endDate
									? ` to ${fmt.date(entry.endDate)}`
									: ''}
							</span>
						</td>
						<td>{entry.entryType === 'income' ? 'Income' : 'Expense'}</td>
						<td>{CASHFLOW_CATEGORY_LABELS[entry.category as CashflowCategory]}</td>
						<td>
							{FREQUENCY_LABELS[entry.frequency as keyof typeof FREQUENCY_LABELS]}
							{#if !entry.isRecurring}<span class="text-muted meta">one-off</span>{/if}
						</td>
						<td class="num">{fmt.money(entry.amount, { currency: entry.currency })}</td>
						<td class="num">
							{entry.isRecurring
								? fmt.money(
										dec(entry.amount)
											.times(
												FREQUENCY_PER_YEAR[entry.frequency as keyof typeof FREQUENCY_PER_YEAR] ?? 0
											)
											.dividedBy(12),
										{ currency: entry.currency }
									)
								: '—'}
						</td>
						<td class="actions-cell">
							<button type="button" class="btn btn-ghost small" onclick={() => openEdit(entry)}>
								Edit
							</button>
							<button type="button" class="btn btn-ghost small" onclick={() => (deleting = entry)}>
								Remove
							</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<RecordDialog
	open={dialog !== 'none'}
	title={dialog === 'edit' ? 'Edit entry' : entryType === 'income' ? 'Add income' : 'Add expense'}
	action={dialog === 'edit' ? '?/update' : '?/create'}
	submitLabel={dialog === 'edit' ? 'Save changes' : 'Save entry'}
	formError={errors._form?.join(' ')}
	onclose={() => {
		dialog = 'none';
		editing = null;
	}}
>
	{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}

	<div class="pair">
		<FormField id="cf-type" label="Direction" errors={errors.entryType} required>
			{#snippet children({ id, describedBy, invalid })}
				<Select
					{id}
					name="entryType"
					options={[
						{ value: 'income', label: 'Income' },
						{ value: 'expense', label: 'Expense' }
					]}
					required
					{invalid}
					{describedBy}
					value={entryType}
					onchange={(e) =>
						(entryType = (e.currentTarget as HTMLSelectElement).value as 'income' | 'expense')}
				/>
			{/snippet}
		</FormField>

		<FormField id="cf-category" label="Category" errors={errors.category} required>
			{#snippet children({ id, describedBy, invalid })}
				<Select
					{id}
					name="category"
					options={categoryOptions}
					required
					{invalid}
					{describedBy}
					value={field('category', editing?.category ?? categoryOptions[0].value)}
				/>
			{/snippet}
		</FormField>
	</div>

	<FormField id="cf-name" label="Name" errors={errors.name} required>
		{#snippet children({ id, describedBy, invalid })}
			<TextInput
				{id}
				name="name"
				required
				{invalid}
				{describedBy}
				value={field('name', editing?.name ?? '')}
				placeholder={entryType === 'income' ? 'e.g. Salary — net' : 'e.g. Groceries'}
			/>
		{/snippet}
	</FormField>

	<div class="pair">
		<FormField id="cf-amount" label="Amount" errors={errors.amount} required>
			{#snippet children({ id, describedBy, invalid })}
				<CurrencyInput
					{id}
					name="amount"
					currency={field('currency', editing?.currency ?? data.baseCurrency)}
					required
					{invalid}
					{describedBy}
					value={field('amount', editing?.amount ?? '')}
				/>
			{/snippet}
		</FormField>

		<FormField id="cf-currency" label="Currency" errors={errors.currency} required>
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

	<div class="pair">
		<FormField
			id="cf-frequency"
			label="Frequency"
			errors={errors.frequency}
			hint="Converted to a monthly figure by occurrences per year."
			required
		>
			{#snippet children({ id, describedBy, invalid })}
				<Select
					{id}
					name="frequency"
					options={frequencyOptions}
					required
					{invalid}
					{describedBy}
					value={field('frequency', editing?.frequency ?? 'monthly')}
				/>
			{/snippet}
		</FormField>

		<FormField id="cf-start" label="Start date" errors={errors.entryDate} required>
			{#snippet children({ id, describedBy, invalid })}
				<DateInput
					{id}
					name="entryDate"
					required
					{invalid}
					{describedBy}
					value={field('entryDate', editing?.entryDate ?? data.today)}
				/>
			{/snippet}
		</FormField>
	</div>

	<FormField
		id="cf-end"
		label="End date"
		errors={errors.endDate}
		hint="Leave empty for an entry with no end."
	>
		{#snippet children({ id, describedBy, invalid })}
			<DateInput
				{id}
				name="endDate"
				{invalid}
				{describedBy}
				value={field('endDate', editing?.endDate ?? '')}
			/>
		{/snippet}
	</FormField>

	<label class="radio">
		<input
			type="checkbox"
			name="isRecurring"
			value="on"
			checked={editing ? editing.isRecurring : true}
		/>
		<span class="dot"></span>
		<span>This repeats — include it in the monthly run rate</span>
	</label>
</RecordDialog>

<ConfirmationDialog
	open={deleting !== null}
	title="Remove this entry?"
	message={deleting
		? `"${deleting.name}" will be deleted. The savings rate, debt-service ratio and emergency cover recompute without it.`
		: ''}
	confirmLabel="Remove entry"
	action="?/delete"
	fields={deleting ? { id: deleting.id } : {}}
	onclose={() => (deleting = null)}
/>

<style>
	.chart-block {
		border-bottom: 2px solid var(--color-divider);
	}
	.entries {
		border-top: 2px solid var(--color-divider);
	}
	h5 {
		margin: 0 0 var(--space-3);
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
	.strong {
		font-weight: 600;
	}
	.bar-cell {
		width: 120px;
	}
	.bar {
		display: block;
		height: 10px;
	}
	.income {
		background: var(--color-text);
	}
	.expense {
		background: var(--color-accent-300);
	}
	.actions-cell {
		text-align: right;
		white-space: nowrap;
	}
	.btn.small {
		font-size: 11px;
	}
	.small {
		font-size: 12.5px;
	}
</style>
