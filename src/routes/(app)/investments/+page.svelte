<script lang="ts">
	import Button from '$components/base/Button.svelte';
	import MetricCard from '$components/base/MetricCard.svelte';
	import PercentageDisplay from '$components/base/PercentageDisplay.svelte';
	import BarMeter from '$components/charts/BarMeter.svelte';
	import ConfirmationDialog from '$components/feedback/ConfirmationDialog.svelte';
	import EmptyState from '$components/feedback/EmptyState.svelte';
	import CurrencyInput from '$components/forms/CurrencyInput.svelte';
	import DateInput from '$components/forms/DateInput.svelte';
	import FormField from '$components/forms/FormField.svelte';
	import NumberInput from '$components/forms/NumberInput.svelte';
	import RecordDialog from '$components/forms/RecordDialog.svelte';
	import Select from '$components/forms/Select.svelte';
	import { getFormatters } from '$lib/stores/formatting.svelte';
	import { showToast } from '$lib/stores/toast.svelte';
	import {
		SUPPORTED_CURRENCIES,
		TRANSACTION_TYPES,
		TRANSACTION_TYPE_LABELS
	} from '$lib/types/domain';
	import { barWidth, dec } from '$engine/money';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const fmt = getFormatters();
	type Tx = PageData['transactions'][number];

	let dialog = $state<'none' | 'transaction' | 'price'>('none');
	let deleting = $state<Tx | null>(null);

	const errors = $derived(form?.success === false ? form.errors : {});
	const values = $derived(form?.success === false ? form.values : {});

	$effect(() => {
		if (form?.success === true) {
			showToast(form.message);
			dialog = 'none';
		}
	});

	const typeOptions = TRANSACTION_TYPES.map((t) => ({
		value: t,
		label: TRANSACTION_TYPE_LABELS[t]
	}));
	const currencyOptions = SUPPORTED_CURRENCIES.map((c) => ({
		value: c.code,
		label: `${c.code} — ${c.name}`
	}));
	const accountOptions = $derived(
		data.accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))
	);
	const holdingOptions = $derived([
		{ value: '', label: 'No specific holding' },
		...data.holdingOptions
	]);

	function field(name: string, fallback: string): string {
		return values[name] ?? fallback;
	}

	const isEmpty = $derived(data.holdings.length === 0);
</script>

<div class="ws-grid ws-grid--4">
	<MetricCard
		label="Market value"
		value={fmt.money(data.portfolio.marketValue)}
		size="sm"
		padding="tight"
	/>
	<MetricCard
		label="Book cost"
		value={fmt.money(data.portfolio.costBasis)}
		note={data.portfolio.costBasisIncomplete
			? 'Partial — some holdings have no cost recorded'
			: undefined}
		size="sm"
		padding="tight"
	/>
	<MetricCard
		label="Unrealised gain"
		value="{fmt.money(data.portfolio.unrealisedGain, { signed: true })} · {data.portfolio
			.unrealisedReturn
			? fmt.percent(data.portfolio.unrealisedReturn, 1, true)
			: '—'}"
		size="sm"
		padding="tight"
		noteTone="accent"
	/>
	<MetricCard
		label="Top holding weight"
		value={data.topWeight ? fmt.percent(data.topWeight) : '—'}
		size="sm"
		padding="tight"
	/>
</div>

{#if isEmpty}
	<EmptyState
		title="No investment holdings"
		description="Holdings are assets in one of the tradeable classes — equities, funds, bonds or crypto. Add one on the Assets screen, then record its trades here to get cost basis, realised gains and return figures."
	>
		{#snippet actions()}
			<a class="btn btn-primary" href="/assets">Add a holding</a>
			<a class="btn btn-secondary" href="/import?kind=transactions">Import transactions</a>
		{/snippet}
	</EmptyState>
{:else}
	<div class="ws-pad ws-scroll-x holdings">
		<div class="ws-section-head">
			<h4>Holdings</h4>
			<div class="ws-row ws-row--end">
				<Button variant="secondary" onclick={() => (dialog = 'price')}>Record price</Button>
				<Button variant="primary" onclick={() => (dialog = 'transaction')}>
					Record transaction
				</Button>
			</div>
		</div>

		<table class="table">
			<caption class="visually-hidden">Investment holdings with cost basis and return</caption>
			<thead>
				<tr>
					<th scope="col">Holding</th>
					<th scope="col">Sleeve</th>
					<th scope="col" class="num">Cost</th>
					<th scope="col" class="num">Value</th>
					<th scope="col" class="num">Return</th>
					<th scope="col" class="num">Weight</th>
				</tr>
			</thead>
			<tbody>
				{#each data.holdings as holding (holding.assetId)}
					<tr>
						<td>
							<span class="name">{holding.name}</span>
							{#if holding.symbol}<span class="text-muted meta">{holding.symbol}</span>{/if}
						</td>
						<td>{holding.sleeve}</td>
						<td class="num">
							{holding.costBasis ? fmt.money(holding.costBasis) : '—'}
						</td>
						<td class="num strong">{fmt.money(holding.marketValue)}</td>
						<td class="num">
							<PercentageDisplay value={holding.unrealisedReturn} signed colored />
						</td>
						<td class="num">
							<span class="weight">
								<span>{holding.weight ? fmt.percent(holding.weight) : '—'}</span>
								<span class="weight-track">
									<span class="weight-fill" style="width:{barWidth(holding.weight)}%"></span>
								</span>
							</span>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<div class="ws-grid ws-grid--2 ws-grid--flush panels">
			<div>
				<h5>Sleeve weights vs target</h5>
				<div class="ws-stack">
					{#each data.sleeves as sleeve (sleeve.sleeve)}
						<BarMeter
							label={sleeve.sleeve}
							percent={barWidth(sleeve.actual)}
							markerPercent={sleeve.target ? sleeve.target.toNumber() : null}
							valueLabel="{sleeve.actual ? fmt.percent(sleeve.actual) : '—'} vs {sleeve.target
								? fmt.percent(sleeve.target, 0)
								: '—'}"
							color={sleeve.drifted ? 'var(--color-accent)' : 'var(--color-text)'}
							size="sm"
						/>
					{/each}
				</div>
				<p class="text-muted small">
					The black tick marks the target weight. Drift beyond ±5 percentage points raises a
					rebalance finding in the analysis run.
				</p>
			</div>

			<div>
				<h5>Realised and income</h5>
				<div class="ws-stack--tight">
					<div class="ws-kv">
						<span>Realised gains (FIFO)</span>
						<span>{fmt.money(data.realised.gain, { signed: true })}</span>
					</div>
					<div class="ws-kv">
						<span>Dividends</span><span>{fmt.money(data.income.dividends)}</span>
					</div>
					<div class="ws-kv">
						<span>Interest</span><span>{fmt.money(data.income.interest)}</span>
					</div>
					<div class="ws-kv">
						<span>Fees and tax</span>
						<span>{fmt.money(data.income.fees.plus(data.income.taxes))}</span>
					</div>
					<div class="ws-kv">
						<span>Total return</span>
						<span>
							{fmt.money(data.total.total, { signed: true })}
							{#if data.total.totalReturnPercent}
								· {fmt.percent(data.total.totalReturnPercent, 1, true)}
							{/if}
						</span>
					</div>
				</div>
				{#if data.realised.unmatchedSales > 0}
					<p class="text-muted small warn">
						{data.realised.unmatchedSales}
						{data.realised.unmatchedSales === 1 ? 'sale' : 'sales'} could not be matched to a purchase
						lot. Realised gains exclude the unmatched quantity — record the missing buys to complete the
						figure.
					</p>
				{/if}
				<p class="text-muted small">
					No annualised return is quoted: doing so would need a full dated cash-flow history for
					every holding, which these records do not yet carry.
				</p>
			</div>
		</div>
	</div>

	<div class="ws-pad ws-scroll-x transactions">
		<h5>Transactions</h5>
		{#if data.transactions.length === 0}
			<p class="text-muted small">
				No transactions recorded. Buys and sells give cost basis and realised gains their inputs.
			</p>
		{:else}
			<table class="table">
				<caption class="visually-hidden">Recorded transactions</caption>
				<thead>
					<tr>
						<th scope="col">Date</th>
						<th scope="col">Type</th>
						<th scope="col">Holding</th>
						<th scope="col">Account</th>
						<th scope="col" class="num">Quantity</th>
						<th scope="col" class="num">Amount</th>
						<th scope="col" class="num">Fees</th>
						<th scope="col"><span class="visually-hidden">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.transactions as tx (tx.id)}
						<tr>
							<td class="num">{fmt.date(tx.date)}</td>
							<td>{TRANSACTION_TYPE_LABELS[tx.type as keyof typeof TRANSACTION_TYPE_LABELS]}</td>
							<td>{tx.assetSymbol ?? tx.assetName ?? '—'}</td>
							<td>{tx.accountName ?? '—'}</td>
							<td class="num">{tx.quantity ?? '—'}</td>
							<td class="num">{fmt.money(tx.grossAmount, { currency: tx.currency })}</td>
							<td class="num">
								{fmt.money(dec(tx.feeAmount).plus(tx.taxAmount), { currency: tx.currency })}
							</td>
							<td class="actions-cell">
								<button type="button" class="btn btn-ghost small" onclick={() => (deleting = tx)}>
									Remove
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
{/if}

<RecordDialog
	open={dialog === 'transaction'}
	title="Record transaction"
	action="?/createTransaction"
	submitLabel="Save transaction"
	formError={errors._form?.join(' ')}
	description="Buys and sells build the cost basis. Dividends, interest, fees and taxes feed the total-return figure."
	onclose={() => (dialog = 'none')}
>
	<div class="pair">
		<FormField id="tx-type" label="Type" errors={errors.transactionType} required>
			{#snippet children({ id, describedBy, invalid })}
				<Select
					{id}
					name="transactionType"
					options={typeOptions}
					required
					{invalid}
					{describedBy}
					value={field('transactionType', 'buy')}
				/>
			{/snippet}
		</FormField>

		<FormField id="tx-date" label="Date" errors={errors.transactionDate} required>
			{#snippet children({ id, describedBy, invalid })}
				<DateInput
					{id}
					name="transactionDate"
					required
					{invalid}
					{describedBy}
					value={field('transactionDate', data.today)}
				/>
			{/snippet}
		</FormField>
	</div>

	<FormField id="tx-account" label="Account" errors={errors.accountId} required>
		{#snippet children({ id, describedBy, invalid })}
			<Select
				{id}
				name="accountId"
				options={accountOptions}
				required
				{invalid}
				{describedBy}
				placeholder={accountOptions.length === 0 ? 'Create an account first' : undefined}
				value={field('accountId', accountOptions[0]?.value ?? '')}
			/>
		{/snippet}
	</FormField>

	<FormField
		id="tx-asset"
		label="Holding"
		errors={errors.assetId}
		hint="Required for a buy or a sell."
	>
		{#snippet children({ id, describedBy, invalid })}
			<Select
				{id}
				name="assetId"
				options={holdingOptions}
				{invalid}
				{describedBy}
				value={field('assetId', '')}
			/>
		{/snippet}
	</FormField>

	<div class="pair">
		<FormField id="tx-quantity" label="Quantity" errors={errors.quantity}>
			{#snippet children({ id, describedBy, invalid })}
				<NumberInput
					{id}
					name="quantity"
					{invalid}
					{describedBy}
					align="right"
					value={field('quantity', '')}
					placeholder=""
				/>
			{/snippet}
		</FormField>

		<FormField id="tx-unit-price" label="Unit price" errors={errors.unitPrice}>
			{#snippet children({ id, describedBy, invalid })}
				<CurrencyInput
					{id}
					name="unitPrice"
					currency={field('currency', data.baseCurrency)}
					{invalid}
					{describedBy}
					value={field('unitPrice', '')}
					placeholder=""
				/>
			{/snippet}
		</FormField>
	</div>

	<div class="pair">
		<FormField
			id="tx-amount"
			label="Amount"
			errors={errors.grossAmount}
			hint="Gross, before fees and tax."
			required
		>
			{#snippet children({ id, describedBy, invalid })}
				<CurrencyInput
					{id}
					name="grossAmount"
					currency={field('currency', data.baseCurrency)}
					required
					{invalid}
					{describedBy}
					value={field('grossAmount', '')}
				/>
			{/snippet}
		</FormField>

		<FormField id="tx-currency" label="Currency" errors={errors.currency} required>
			{#snippet children({ id, describedBy, invalid })}
				<Select
					{id}
					name="currency"
					options={currencyOptions}
					required
					{invalid}
					{describedBy}
					value={field('currency', data.baseCurrency)}
				/>
			{/snippet}
		</FormField>
	</div>

	<div class="pair">
		<FormField id="tx-fee" label="Fees" errors={errors.feeAmount}>
			{#snippet children({ id, describedBy, invalid })}
				<CurrencyInput
					{id}
					name="feeAmount"
					currency={field('currency', data.baseCurrency)}
					{invalid}
					{describedBy}
					value={field('feeAmount', '0')}
				/>
			{/snippet}
		</FormField>

		<FormField id="tx-tax" label="Tax" errors={errors.taxAmount}>
			{#snippet children({ id, describedBy, invalid })}
				<CurrencyInput
					{id}
					name="taxAmount"
					currency={field('currency', data.baseCurrency)}
					{invalid}
					{describedBy}
					value={field('taxAmount', '0')}
				/>
			{/snippet}
		</FormField>
	</div>
</RecordDialog>

<RecordDialog
	open={dialog === 'price'}
	title="Record price"
	action="?/recordPrice"
	submitLabel="Save price"
	formError={errors._form?.join(' ')}
	description="Prices are entered manually or arrive from an import. Recording the latest price revalues the holding; the history feeds volatility and correlation."
	onclose={() => (dialog = 'none')}
>
	<FormField id="price-asset" label="Holding" errors={errors.assetId} required>
		{#snippet children({ id, describedBy, invalid })}
			<Select
				{id}
				name="assetId"
				options={data.holdingOptions}
				required
				{invalid}
				{describedBy}
				value={field('assetId', data.holdingOptions[0]?.value ?? '')}
			/>
		{/snippet}
	</FormField>

	<div class="pair">
		<FormField id="price-value" label="Price" errors={errors.price} required>
			{#snippet children({ id, describedBy, invalid })}
				<CurrencyInput
					{id}
					name="price"
					currency={field('currency', data.baseCurrency)}
					required
					{invalid}
					{describedBy}
					value={field('price', '')}
				/>
			{/snippet}
		</FormField>

		<FormField id="price-currency" label="Currency" errors={errors.currency} required>
			{#snippet children({ id, describedBy, invalid })}
				<Select
					{id}
					name="currency"
					options={currencyOptions}
					required
					{invalid}
					{describedBy}
					value={field('currency', data.baseCurrency)}
				/>
			{/snippet}
		</FormField>
	</div>

	<FormField id="price-date" label="Price date" errors={errors.priceDate} required>
		{#snippet children({ id, describedBy, invalid })}
			<DateInput
				{id}
				name="priceDate"
				required
				{invalid}
				{describedBy}
				value={field('priceDate', data.today)}
			/>
		{/snippet}
	</FormField>
</RecordDialog>

<ConfirmationDialog
	open={deleting !== null}
	title="Remove this transaction?"
	message="Realised gains and cost basis are computed from trade history, so removing this changes those figures."
	confirmLabel="Remove transaction"
	action="?/deleteTransaction"
	fields={deleting ? { id: deleting.id } : {}}
	onclose={() => (deleting = null)}
/>

<style>
	.holdings {
		border-bottom: 2px solid var(--color-divider);
	}
	h4,
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
	}
	.strong {
		font-weight: 600;
	}
	.weight {
		display: flex;
		align-items: center;
		gap: 8px;
		justify-content: flex-end;
	}
	.weight-track {
		width: 56px;
		height: 8px;
		background: var(--color-neutral-200);
		display: block;
		flex: none;
	}
	.weight-fill {
		display: block;
		height: 100%;
		background: var(--color-text);
	}
	.panels {
		margin-top: var(--space-6);
		border-top: 2px solid var(--color-divider);
		padding-top: var(--space-6);
		gap: var(--space-6);
		background: transparent;
		border-bottom: 0;
	}
	.panels > :global(*) {
		background: transparent;
	}
	.small {
		font-size: 11.5px;
		margin-top: var(--space-3);
	}
	.warn {
		color: var(--color-accent-700);
	}
	.actions-cell {
		text-align: right;
		white-space: nowrap;
	}
	.btn.small {
		font-size: 11px;
	}
</style>
