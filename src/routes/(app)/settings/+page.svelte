<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$components/base/Button.svelte';
	import StatusTag from '$components/base/StatusTag.svelte';
	import ErrorMessage from '$components/feedback/ErrorMessage.svelte';
	import DateInput from '$components/forms/DateInput.svelte';
	import FormField from '$components/forms/FormField.svelte';
	import NumberInput from '$components/forms/NumberInput.svelte';
	import SegmentedControl from '$components/forms/SegmentedControl.svelte';
	import Select from '$components/forms/Select.svelte';
	import TextInput from '$components/forms/TextInput.svelte';
	import { getFormatters } from '$lib/stores/formatting.svelte';
	import { showToast } from '$lib/stores/toast.svelte';
	import { SUPPORTED_CURRENCIES } from '$lib/types/domain';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const fmt = getFormatters();

	let savingPrefs = $state(false);
	let savingProfile = $state(false);
	let savingRate = $state(false);
	let theme = $state<'light' | 'dark' | 'system'>('system');

	const errors = $derived(form?.success === false ? form.errors : {});
	const values = $derived(form?.success === false ? form.values : {});

	$effect(() => {
		if (form?.success === true) showToast(form.message);
	});

	// The appearance preference is a browser concern, persisted where the
	// pre-paint script in app.html can read it before first render.
	$effect(() => {
		const stored = localStorage.getItem('ws.theme');
		theme = stored === 'dark' || stored === 'light' ? stored : 'system';
	});

	function applyTheme(next: 'light' | 'dark' | 'system') {
		theme = next;
		if (next === 'system') {
			localStorage.removeItem('ws.theme');
			document.documentElement.dataset.theme = window.matchMedia('(prefers-color-scheme: dark)')
				.matches
				? 'dark'
				: 'light';
		} else {
			localStorage.setItem('ws.theme', next);
			document.documentElement.dataset.theme = next;
		}
	}

	const currencyOptions = SUPPORTED_CURRENCIES.map((c) => ({
		value: c.code,
		label: `${c.code} — ${c.name}`
	}));

	const monthOptions = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	].map((label, i) => ({ value: String(i + 1), label }));

	function field(name: string, fallback: string): string {
		return values[name] ?? fallback;
	}

	const today = new Date().toISOString().slice(0, 10);
</script>

<div class="ws-grid ws-grid--2">
	<div class="ws-pad">
		<h4>Preferences</h4>
		<p class="text-muted small">
			The base currency is what every total on every screen is converted into. Changing it does not
			rewrite any record — each one keeps the currency it was entered in.
		</p>

		{#if errors._form}
			<ErrorMessage
				message={errors._form.join(' ')}
				code={form?.success === false ? form.code : undefined}
			/>
		{/if}

		<form
			method="POST"
			action="?/preferences"
			use:enhance={() => {
				savingPrefs = true;
				return async ({ update }) => {
					await update({ reset: false });
					savingPrefs = false;
				};
			}}
			novalidate
		>
			<div class="fields">
				<div class="pair">
					<FormField id="base-currency" label="Base currency" errors={errors.baseCurrency} required>
						{#snippet children({ id, describedBy, invalid })}
							<Select
								{id}
								name="baseCurrency"
								options={currencyOptions}
								required
								{invalid}
								{describedBy}
								value={field('baseCurrency', data.settings.baseCurrency)}
							/>
						{/snippet}
					</FormField>

					<FormField
						id="locale"
						label="Locale"
						errors={errors.locale}
						hint="Controls number and date formatting."
						required
					>
						{#snippet children({ id, describedBy, invalid })}
							<TextInput
								{id}
								name="locale"
								required
								{invalid}
								{describedBy}
								value={field('locale', data.settings.locale)}
							/>
						{/snippet}
					</FormField>
				</div>

				<div class="pair">
					<FormField id="timezone" label="Timezone" errors={errors.timezone} required>
						{#snippet children({ id, describedBy, invalid })}
							<TextInput
								{id}
								name="timezone"
								required
								{invalid}
								{describedBy}
								value={field('timezone', data.settings.timezone)}
							/>
						{/snippet}
					</FormField>

					<FormField
						id="fiscal-month"
						label="Fiscal year starts"
						errors={errors.fiscalYearStartMonth}
						required
					>
						{#snippet children({ id, describedBy, invalid })}
							<Select
								{id}
								name="fiscalYearStartMonth"
								options={monthOptions}
								required
								{invalid}
								{describedBy}
								value={field('fiscalYearStartMonth', String(data.settings.fiscalYearStartMonth))}
							/>
						{/snippet}
					</FormField>
				</div>

				<div class="pair">
					<FormField
						id="return-assumption"
						label="Expected annual return"
						errors={errors.defaultReturnAssumption}
						hint="Percent. Used as the projection default."
						required
					>
						{#snippet children({ id, describedBy, invalid })}
							<NumberInput
								{id}
								name="defaultReturnAssumption"
								required
								{invalid}
								{describedBy}
								align="right"
								value={field('defaultReturnAssumption', data.settings.defaultReturnAssumption)}
							/>
						{/snippet}
					</FormField>

					<FormField
						id="inflation-assumption"
						label="Expected inflation"
						errors={errors.defaultInflationAssumption}
						hint="Percent."
						required
					>
						{#snippet children({ id, describedBy, invalid })}
							<NumberInput
								{id}
								name="defaultInflationAssumption"
								required
								{invalid}
								{describedBy}
								align="right"
								value={field(
									'defaultInflationAssumption',
									data.settings.defaultInflationAssumption
								)}
							/>
						{/snippet}
					</FormField>
				</div>

				<div class="pair">
					<FormField
						id="emergency-months"
						label="Emergency fund target"
						errors={errors.emergencyFundMonths}
						hint="Months of expenses. The liquidity score is graded against this."
						required
					>
						{#snippet children({ id, describedBy, invalid })}
							<NumberInput
								{id}
								name="emergencyFundMonths"
								required
								{invalid}
								{describedBy}
								align="right"
								value={field('emergencyFundMonths', String(data.settings.emergencyFundMonths))}
							/>
						{/snippet}
					</FormField>

					<div class="field">
						<span class="field-label" id="rounding-label">Rounding</span>
						<div aria-labelledby="rounding-label">
							<SegmentedControl
								name="displayDecimals"
								legend="Rounding"
								options={[
									{ value: '0', label: 'Whole' },
									{ value: '2', label: '2 dp' }
								]}
								value={field('displayDecimals', String(data.settings.displayDecimals))}
							/>
						</div>
						<p class="field-hint">
							Display only. Values are always stored and computed at full precision.
						</p>
					</div>
				</div>

				<div class="pair">
					<FormField
						id="birth-year"
						label="Year of birth"
						errors={errors.birthYear}
						hint="Used for milestone ages only."
					>
						{#snippet children({ id, describedBy, invalid })}
							<NumberInput
								{id}
								name="birthYear"
								{invalid}
								{describedBy}
								align="right"
								value={field(
									'birthYear',
									data.settings.birthYear ? String(data.settings.birthYear) : ''
								)}
								placeholder=""
							/>
						{/snippet}
					</FormField>

					<FormField
						id="retirement-age"
						label="Target retirement age"
						errors={errors.retirementAge}
					>
						{#snippet children({ id, describedBy, invalid })}
							<NumberInput
								{id}
								name="retirementAge"
								{invalid}
								{describedBy}
								align="right"
								value={field(
									'retirementAge',
									data.settings.retirementAge ? String(data.settings.retirementAge) : ''
								)}
								placeholder=""
							/>
						{/snippet}
					</FormField>
				</div>
			</div>

			<Button variant="primary" type="submit" pending={savingPrefs} pendingLabel="Saving…">
				Save preferences
			</Button>
		</form>

		<div class="hr"></div>

		<h4>Appearance</h4>
		<div class="seg" role="group" aria-label="Appearance">
			{#each [['light', 'Light'], ['dark', 'Dark'], ['system', 'System']] as [value, label] (value)}
				<label class="seg-opt">
					<input
						type="radio"
						name="theme"
						checked={theme === value}
						onchange={() => applyTheme(value as 'light' | 'dark' | 'system')}
					/>
					<span>{label}</span>
				</label>
			{/each}
		</div>
		<p class="text-muted tiny">
			Stored in this browser, not on your account, so each device can differ.
		</p>
	</div>

	<div class="ws-pad">
		<h4>Your account</h4>
		<form
			method="POST"
			action="?/profile"
			use:enhance={() => {
				savingProfile = true;
				return async ({ update }) => {
					await update({ reset: false });
					savingProfile = false;
				};
			}}
			novalidate
		>
			<div class="fields">
				<FormField id="profile-name" label="Name" errors={errors.name} required>
					{#snippet children({ id, describedBy, invalid })}
						<TextInput
							{id}
							name="name"
							required
							{invalid}
							{describedBy}
							value={field('name', data.profile.name)}
						/>
					{/snippet}
				</FormField>

				<div class="field">
					<span class="field-label">Email</span>
					<p class="readonly">{data.profile.email}</p>
					<p class="field-hint">
						Changing an email address requires re-verification, which needs a mail transport. None
						is configured on this deployment.
					</p>
				</div>
			</div>
			<Button variant="secondary" type="submit" pending={savingProfile} pendingLabel="Saving…">
				Save profile
			</Button>
		</form>

		<div class="hr"></div>

		<h4>Storage</h4>
		<table class="table">
			<caption class="visually-hidden">What is stored on your account</caption>
			<tbody>
				<tr><td>Records</td><td class="num">{data.summary.recordCount}</td></tr>
				<tr>
					<td>Last write</td>
					<td class="num">
						{data.summary.lastUpdated ? fmt.date(data.summary.lastUpdated.slice(0, 10)) : '—'}
					</td>
				</tr>
				<tr>
					<td>Last snapshot</td>
					<td class="num">{data.lastSnapshot ? fmt.date(data.lastSnapshot) : 'None yet'}</td>
				</tr>
				<tr><td>Imports recorded</td><td class="num">{data.imports.length}</td></tr>
			</tbody>
		</table>
		<p class="text-muted tiny">
			Records live in a PostgreSQL database and are scoped to your account. Export them at any time
			from <a href="/reports">Reports</a> — the CSV mirrors the import schema, so a round trip loses nothing.
		</p>

		<div class="hr"></div>

		<h4>Sign out</h4>
		<form method="POST" action="/logout">
			<Button variant="secondary" type="submit">Sign out of this browser</Button>
		</form>
	</div>
</div>

<div class="ws-grid ws-grid--flush ws-grid--side">
	<div class="ws-pad ws-scroll-x">
		<h4>Exchange rates</h4>
		<p class="text-muted small">
			A holding in another currency is only included in your totals when a rate to
			{data.settings.baseCurrency} can be resolved — directly, by inversion, or through a pivot currency.
			Rates are entered by hand; no market-data provider is called.
		</p>

		{#if data.rates.length === 0}
			<p class="text-muted small">
				No rates recorded. That is fine while everything is in one currency.
			</p>
		{:else}
			<table class="table">
				<caption class="visually-hidden">Recorded exchange rates</caption>
				<thead>
					<tr>
						<th scope="col">Pair</th>
						<th scope="col" class="num">Rate</th>
						<th scope="col">Date</th>
						<th scope="col">Source</th>
						<th scope="col"><span class="visually-hidden">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.rates as rate (rate.id)}
						<tr>
							<td class="strong">{rate.baseCurrency} → {rate.quoteCurrency}</td>
							<td class="num">{rate.rate}</td>
							<td>{fmt.date(rate.rateDate)}</td>
							<td><StatusTag>{rate.source}</StatusTag></td>
							<td class="actions-cell">
								<form method="POST" action="?/deleteRate" use:enhance>
									<input type="hidden" name="id" value={rate.id} />
									<button type="submit" class="btn btn-ghost small">Remove</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<div class="ws-pad">
		<h5>Add a rate</h5>
		<form
			method="POST"
			action="?/addRate"
			use:enhance={() => {
				savingRate = true;
				return async ({ update }) => {
					await update({ reset: false });
					savingRate = false;
				};
			}}
			novalidate
		>
			<div class="fields">
				<div class="pair">
					<FormField id="rate-base" label="From" errors={errors.baseCurrency} required>
						{#snippet children({ id, describedBy, invalid })}
							<Select
								{id}
								name="baseCurrency"
								options={currencyOptions}
								required
								{invalid}
								{describedBy}
								value={field('baseCurrency', 'USD')}
							/>
						{/snippet}
					</FormField>

					<FormField id="rate-quote" label="To" errors={errors.quoteCurrency} required>
						{#snippet children({ id, describedBy, invalid })}
							<Select
								{id}
								name="quoteCurrency"
								options={currencyOptions}
								required
								{invalid}
								{describedBy}
								value={field('quoteCurrency', data.settings.baseCurrency)}
							/>
						{/snippet}
					</FormField>
				</div>

				<FormField
					id="rate-value"
					label="Rate"
					errors={errors.rate}
					hint="How many of the second currency one of the first buys."
					required
				>
					{#snippet children({ id, describedBy, invalid })}
						<NumberInput
							{id}
							name="rate"
							required
							{invalid}
							{describedBy}
							align="right"
							value={field('rate', '')}
						/>
					{/snippet}
				</FormField>

				<FormField id="rate-date" label="Rate date" errors={errors.rateDate} required>
					{#snippet children({ id, describedBy, invalid })}
						<DateInput
							{id}
							name="rateDate"
							required
							{invalid}
							{describedBy}
							value={field('rateDate', today)}
						/>
					{/snippet}
				</FormField>
			</div>
			<Button variant="primary" type="submit" block pending={savingRate} pendingLabel="Saving…">
				Save rate
			</Button>
		</form>
	</div>
</div>

<style>
	h4 {
		margin: 0 0 var(--space-2);
	}
	h5 {
		margin: 0 0 var(--space-3);
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin: var(--space-4) 0;
	}
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}
	.small {
		font-size: 12.5px;
	}
	.tiny {
		font-size: 11.5px;
	}
	.readonly {
		font-size: 14px;
		margin: 0;
		padding: 6px 0;
	}
	.strong {
		font-weight: 600;
	}
	.actions-cell {
		text-align: right;
	}
	.btn.small {
		font-size: 11px;
	}
	@media (max-width: 640px) {
		.pair {
			grid-template-columns: 1fr;
		}
	}
</style>
